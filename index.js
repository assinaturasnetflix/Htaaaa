const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do servidor
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Configuração do PostgreSQL no Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Configuração para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './');  // Salvar na raiz
  },
  filename: (req, file, cb) => {
    cb(null, 'img_' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// Inicialização do Banco de Dados
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id),
        receiver_id INTEGER REFERENCES users(id),
        group_id INTEGER NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER REFERENCES groups(id),
        user_id INTEGER REFERENCES users(id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
      );
    `);
    console.log('Banco de dados inicializado com sucesso');
  } catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err);
  }
};

// Autenticação de Usuários
const SECRET_KEY = process.env.JWT_SECRET || 'seu_segredo_jwt';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Acesso negado' });
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// Rotas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para página de admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Rotas de autenticação
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validação básica
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
    
    // Verifica se o usuário já existe
    const userExists = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }
    
    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insere o usuário no banco
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );
    
    // Gera token JWT
    const token = jwt.sign(
      { id: result.rows[0].id, username: result.rows[0].username },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({ 
      message: 'Usuário registrado com sucesso',
      token,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email
      }
    });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Busca o usuário pelo email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email ou senha incorretos' });
    }
    
    const user = result.rows[0];
    
    // Verifica a senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Email ou senha incorretos' });
    }
    
    // Gera token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, isAdmin: user.is_admin },
      SECRET_KEY,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login bem-sucedido',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// Rotas para mensagens
app.post('/api/send-message', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { receiver_id, group_id, content } = req.body;
    const sender_id = req.user.id;
    let image_url = null;
    
    if (req.file) {
      image_url = req.file.filename;
    }
    
    // Validação
    if (!content && !image_url) {
      return res.status(400).json({ error: 'Mensagem vazia não permitida' });
    }
    
    if (!receiver_id && !group_id) {
      return res.status(400).json({ error: 'Destinatário ou grupo não especificado' });
    }
    
    // Insere a mensagem no banco
    const result = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, group_id, content, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [sender_id, receiver_id || null, group_id || null, content, image_url]
    );
    
    const message = result.rows[0];
    
    // Notifica os clientes via Socket.io
    if (group_id) {
      io.to(`group_${group_id}`).emit('new_message', {
        ...message,
        sender_username: req.user.username
      });
    } else {
      io.to(`user_${receiver_id}`).emit('new_message', {
        ...message,
        sender_username: req.user.username
      });
      io.to(`user_${sender_id}`).emit('new_message', {
        ...message,
        sender_username: req.user.username
      });
    }
    
    res.status(201).json({ message: 'Mensagem enviada com sucesso', data: message });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const currentUserId = req.user.id;
    
    const result = await pool.query(
      `SELECT m.*, u.username as sender_username 
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR 
             (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [currentUserId, userId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

app.get('/api/group-messages/:groupId', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    
    // Verifica se o usuário é membro do grupo
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );
    
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Você não é membro deste grupo' });
    }
    
    const result = await pool.query(
      `SELECT m.*, u.username as sender_username 
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.group_id = $1
       ORDER BY m.created_at ASC`,
      [groupId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar mensagens do grupo:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens do grupo' });
  }
});

// Rotas para grupos
app.post('/api/groups', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const created_by = req.user.id;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
    }
    
    // Cria o grupo
    const result = await pool.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, created_by]
    );
    
    const groupId = result.rows[0].id;
    
    // Adiciona o criador como membro
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [groupId, created_by]
    );
    
    res.status(201).json({
      message: 'Grupo criado com sucesso',
      group: result.rows[0]
    });
  } catch (err) {
    console.error('Erro ao criar grupo:', err);
    res.status(500).json({ error: 'Erro ao criar grupo' });
  }
});

app.post('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { userId } = req.body;
    
    // Verifica se o usuário que está adicionando é o criador do grupo
    const groupCheck = await pool.query(
      'SELECT * FROM groups WHERE id = $1 AND created_by = $2',
      [groupId, req.user.id]
    );
    
    if (groupCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Apenas o criador do grupo pode adicionar membros' });
    }
    
    // Verifica se o usuário já é membro
    const memberCheck = await pool.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Usuário já é membro deste grupo' });
    }
    
    // Adiciona o usuário ao grupo
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [groupId, userId]
    );
    
    res.status(201).json({ message: 'Membro adicionado com sucesso' });
  } catch (err) {
    console.error('Erro ao adicionar membro ao grupo:', err);
    res.status(500).json({ error: 'Erro ao adicionar membro ao grupo' });
  }
});

app.get('/api/groups', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.* 
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar grupos:', err);
    res.status(500).json({ error: 'Erro ao buscar grupos' });
  }
});

// Rotas para usuários
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, is_admin, created_at FROM users'
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Rotas de administração (apenas para admin)
app.put('/api/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Apenas administradores podem acessar esta rota' });
    }
    
    const userId = parseInt(req.params.userId);
    const { username, email, is_admin } = req.body;
    
    // Atualiza os dados do usuário
    const result = await pool.query(
      'UPDATE users SET username = $1, email = $2, is_admin = $3 WHERE id = $4 RETURNING id, username, email, is_admin',
      [username, email, is_admin, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({
      message: 'Usuário atualizado com sucesso',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

app.delete('/api/admin/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Apenas administradores podem acessar esta rota' });
    }
    
    const userId = parseInt(req.params.userId);
    
    // Remove o usuário do banco
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    res.json({ message: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error('Erro ao remover usuário:', err);
    res.status(500).json({ error: 'Erro ao remover usuário' });
  }
});

// Configuração do Socket.io
io.on('connection', (socket) => {
  console.log('Novo cliente conectado');
  
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Usuário ${userId} entrou na sala`);
  });
  
  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
    console.log(`Usuário entrou no grupo ${groupId}`);
  });
  
  socket.on('chat_message', async (data) => {
    try {
      const { sender_id, receiver_id, group_id, content, image_url } = data;
      
      // Insere a mensagem no banco
      const result = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, group_id, content, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [sender_id, receiver_id || null, group_id || null, content, image_url]
      );
      
      const message = result.rows[0];
      
      // Busca o nome do remetente
      const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [sender_id]);
      const sender_username = userResult.rows[0].username;
      
      // Emite a mensagem para o destinatário ou grupo
      if (group_id) {
        io.to(`group_${group_id}`).emit('new_message', {
          ...message,
          sender_username
        });
      } else {
        io.to(`user_${receiver_id}`).emit('new_message', {
          ...message,
          sender_username
        });
        io.to(`user_${sender_id}`).emit('new_message', {
          ...message,
          sender_username
        });
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Inicializa o banco de dados e inicia o servidor
initDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}).catch(err => {
  console.error('Falha ao iniciar o servidor:', err);
});
