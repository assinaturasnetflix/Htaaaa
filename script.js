document.addEventListener('DOMContentLoaded', function() {
    // Elementos da autenticação
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    
    // Elementos do chat
    const currentUsername = document.getElementById('current-username');
    const userInitial = document.getElementById('user-initial');
    const logoutBtn = document.getElementById('logout-btn');
    const usersTab = document.getElementById('users-tab');
    const groupsTab = document.getElementById('groups-tab');
    const usersListContainer = document.getElementById('users-list-container');
    const groupsListContainer = document.getElementById('groups-list-container');
    const usersList = document.getElementById('users-list');
    const groupsList = document.getElementById('groups-list');
    const emptyChat = document.getElementById('empty-chat');
    const activeChat = document.getElementById('active-chat');
    const recipientName = document.getElementById('recipient-name');
    const recipientInitial = document.getElementById('recipient-initial');
    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const imageUpload = document.getElementById('image-upload');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeImage = document.getElementById('remove-image');
    
    // Elementos do modal de novo grupo
    const newGroupBtn = document.getElementById('new-group-btn');
    const newGroupModal = document.getElementById('new-group-modal');
    const closeModal = document.getElementById('close-modal');
    const newGroupForm = document.getElementById('new-group-form');
    
    // Variáveis globais
    let currentUser = null;
    let socket = null;
    let currentRecipient = null;
    let selectedFile = null;
    
    // Inicialização
    init();
    
    function init() {
        // Verificar se o usuário está logado
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token && user) {
            currentUser = JSON.parse(user);
            showChatInterface();
            setupSocket();
            loadUsers();
            loadGroups();
        }
        
        // Eventos de autenticação
        loginTab.addEventListener('click', () => switchAuthTab('login'));
        registerTab.addEventListener('click', () => switchAuthTab('register'));
        loginForm.addEventListener('submit', handleLogin);
        registerForm.addEventListener('submit', handleRegister);
        
        // Eventos do chat
        logoutBtn.addEventListener('click', handleLogout);
        usersTab.addEventListener('click', () => switchChatTab('users'));
        groupsTab.addEventListener('click', () => switchChatTab('groups'));
        messageForm.addEventListener('submit', handleSendMessage);
        
        // Eventos de imagem
        imageUpload.addEventListener('change', handleImageSelect);
        removeImage.addEventListener('click', removeSelectedImage);
        
        // Eventos do modal
        newGroupBtn.addEventListener('click', showNewGroupModal);
        closeModal.addEventListener('click', hideNewGroupModal);
        newGroupForm.addEventListener('submit', handleCreateGroup);
    }
    
    // Funções de autenticação
    function switchAuthTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    }
    
    async function handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer login');
            }
            
            // Armazenar dados de autenticação
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            
            // Mostrar interface de chat
            showChatInterface();
            setupSocket();
            loadUsers();
            loadGroups();
            
        } catch (error) {
            loginError.textContent = error.message;
        }
    }
    
    async function handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro ao registrar usuário');
            }
            
            // Armazenar dados de autenticação
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            
            // Mostrar interface de chat
            showChatInterface();
            setupSocket();
            loadUsers();
            loadGroups();
            
        } catch (error) {
            registerError.textContent = error.message;
        }
    }
    
    function handleLogout() {
        // Limpar dados da sessão
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        currentUser = null;
        
        // Desconectar o socket
        if (socket) {
            socket.disconnect();
        }
        
        // Mostrar tela de login
        showAuthInterface();
    }
    
    // Funções de inicialização da interface
    function showChatInterface() {
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        // Atualiza a interface com dados do usuário
        currentUsername.textContent = currentUser.username;
        userInitial.textContent = currentUser.username.charAt(0).toUpperCase();
    }
    
    function showAuthInterface() {
        chatContainer.style.display = 'none';
        authContainer.style.display = 'flex';
        
        // Limpar formulários
        loginForm.reset();
        registerForm.reset();
        loginError.textContent = '';
        registerError.textContent = '';
    }
    
    function setupSocket() {
        socket = io();
        
        // Configurar a sala do usuário
        socket.emit('join_user', currentUser.id);
        
        // Escutar novas mensagens
        socket.on('new_message', handleNewMessage);
    }
    
    // Funções de navegação na interface
    function switchChatTab(tab) {
        if (tab === 'users') {
            usersTab.classList.add('active');
            groupsTab.classList.remove('active');
            usersListContainer.style.display = 'block';
            groupsListContainer.style.display = 'none';
        } else {
            usersTab.classList.remove('active');
            groupsTab.classList.add('active');
            usersListContainer.style.display = 'none';
            groupsListContainer.style.display = 'block';
        }
    }
    
    // Carregamento de dados
    async function loadUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar usuários');
            }
            
            const users = await response.json();
            
            // Limpar a lista
            usersList.innerHTML = '';
            
            // Adicionar usuários (exceto o usuário atual)
            users.forEach(user => {
                if (user.id !== currentUser.id) {
                    const li = document.createElement('li');
                    li.textContent = user.username;
                    li.dataset.userId = user.id;
                    li.dataset.username = user.username;
                    
                    li.addEventListener('click', () => {
                        // Remover classe ativa de todos os itens
                        document.querySelectorAll('.users-list li').forEach(item => {
                            item.classList.remove('active');
                        });
                        
                        // Adicionar classe ativa ao item clicado
                        li.classList.add('active');
                        
                        // Configurar o chat individual
                        setupDirectChat(user);
                    });
                    
                    usersList.appendChild(li);
                }
            });
            
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }
    
    async function loadGroups() {
        try {
            const response = await fetch('/api/groups', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar grupos');
            }
            
            const groups = await response.json();
            
            // Limpar a lista
            groupsList.innerHTML = '';
            
            // Adicionar grupos
            groups.forEach(group => {
                const li = document.createElement('li');
                li.textContent = group.name;
                li.dataset.groupId = group.id;
                li.dataset.groupName = group.name;
                
                li.addEventListener('click', () => {
                    // Remover classe ativa de todos os itens
                    document.querySelectorAll('.groups-list li').forEach(item => {
                        item.classList.remove('active');
                    });
                    
                    // Adicionar classe ativa ao item clicado
                    li.classList.add('active');
                    
                    // Configurar o chat em grupo
                    setupGroupChat(group);
                });
                
                groupsList.appendChild(li);
            });
            
        } catch (error) {
            console.error('Erro ao carregar grupos:', error);
        }
    }
    
    // Funções de chat
    function setupDirectChat(user) {
        currentRecipient = {
            id: user.id,
            name: user.username,
            type: 'user'
        };
        
        // Mostrar área de chat ativa
        emptyChat.style.display = 'none';
        activeChat.style.display = 'flex';
        
        // Configurar cabeçalho
        recipientName.textContent = user.username;
        recipientInitial.textContent = user.username.charAt(0).toUpperCase();
        
        // Limpar mensagens anteriores
        messagesContainer.innerHTML = '';
        
        // Carregar mensagens
        loadDirectMessages(user.id);
    }
    
    function setupGroupChat(group) {
        currentRecipient = {
            id: group.id,
            name: group.name,
            type: 'group'
        };
        
        // Entrar na sala do grupo via Socket.io
        socket.emit('join_group', group.id);
        
        // Mostrar área de chat ativa
        emptyChat.style.display = 'none';
        activeChat.style.display = 'flex';
        
        // Configurar cabeçalho
        recipientName.textContent = group.name;
        recipientInitial.textContent = group.name.charAt(0).toUpperCase();
        
        // Limpar mensagens anteriores
        messagesContainer.innerHTML = '';
        
        // Carregar mensagens
        loadGroupMessages(group.id);
    }
    
    async function loadDirectMessages(userId) {
        try {
            const response = await fetch(`/api/messages/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar mensagens');
            }
            
            const messages = await response.json();
            displayMessages(messages);
            
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    }
    
    async function loadGroupMessages(groupId) {
        try {
            const response = await fetch(`/api/group-messages/${groupId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar mensagens do grupo');
            }
            
            const messages = await response.json();
            displayMessages(messages);
            
        } catch (error) {
            console.error('Erro ao carregar mensagens do grupo:', error);
        }
    }
    
    function displayMessages(messages) {
        // Limpar mensagens anteriores
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            const isOutgoing = message.sender_id === currentUser.id;
            
            const messageEl = document.createElement('div');
            messageEl.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
            
            const messageContent = document.createElement('div');
            
            // Se não for mensagem do usuário atual, mostrar nome do remetente
            if (!isOutgoing) {
                const messageSender = document.createElement('div');
                messageSender.className = 'message-sender';
                messageSender.textContent = message.sender_username || 'Usuário';
                messageContent.appendChild(messageSender);
            }
            
            // Conteúdo da mensagem
            const messageText = document.createElement('div');
            messageText.className = 'message-content';
            messageText.textContent = message.content;
            messageContent.appendChild(messageText);
            
            // Se tiver imagem
            if (message.image_url) {
                const messageImage = document.createElement('img');
                messageImage.className = 'message-image';
                messageImage.src = message.image_url;
                messageImage.alt = 'Imagem enviada';
                messageContent.appendChild(messageImage);
            }
            
            // Horário da mensagem
            const messageTime = document.createElement('div');
            messageTime.className = 'message-time';
            messageTime.textContent = formatDate(message.created_at);
            messageContent.appendChild(messageTime);
            
            messageEl.appendChild(messageContent);
            messagesContainer.appendChild(messageEl);
        });
        
        // Rolar para o final
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async function handleSendMessage(e) {
        e.preventDefault();
        
        if (!currentRecipient) {
            return;
        }
        
        const content = messageInput.value.trim();
        
        if (!content && !selectedFile) {
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('content', content);
            
            if (currentRecipient.type === 'user') {
                formData.append('receiver_id', currentRecipient.id);
            } else {
                formData.append('group_id', currentRecipient.id);
            }
            
            if (selectedFile) {
                formData.append('image', selectedFile);
            }
            
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Erro ao enviar mensagem');
            }
            
            // Limpar campos
            messageInput.value = '';
            removeSelectedImage();
            
            // Se for mensagem direta, recarregar mensagens
            if (currentRecipient.type === 'user') {
                loadDirectMessages(currentRecipient.id);
            } else {
                loadGroupMessages(currentRecipient.id);
            }
            
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }
    
    function handleNewMessage(message) {
        // Verificar se a mensagem é relevante para a conversa atual
        const isRelevantDirectMessage = currentRecipient && 
                                       currentRecipient.type === 'user' && 
                                       (message.sender_id === currentRecipient.id || 
                                        message.receiver_id === currentRecipient.id);
        
        const isRelevantGroupMessage = currentRecipient && 
                                      currentRecipient.type === 'group' && 
                                      message.group_id === currentRecipient.id;
        
        if (isRelevantDirectMessage || isRelevantGroupMessage) {
            // Se for mensagem para a conversa atual, atualizar a visualização
            if (currentRecipient.type === 'user') {
                loadDirectMessages(currentRecipient.id);
            } else {
                loadGroupMessages(currentRecipient.id);
            }
        }
    }
    
    // Funções para manipulação de imagens
    function handleImageSelect(e) {
        if (e.target.files && e.target.files[0]) {
            selectedFile = e.target.files[0];
            
            const reader = new FileReader();
            reader.onload = function(event) {
                previewImg.src = event.target.result;
                imagePreview.style.display = 'block';
            };
            
            reader.readAsDataURL(selectedFile);
        }
    }
    
    function removeSelectedImage() {
        selectedFile = null;
        imageUpload.value = '';
        imagePreview.style.display = 'none';
    }
    
    // Funções para grupos
    function showNewGroupModal() {
        newGroupModal.style.display = 'flex';
    }
    
    function hideNewGroupModal() {
        newGroupModal.style.display = 'none';
        newGroupForm.reset();
    }
    
    async function handleCreateGroup(e) {
        e.preventDefault();
        
        const groupName = document.getElementById('group-name').value.trim();
        
        if (!groupName) {
            return;
        }
        
        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name: groupName })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao criar grupo');
            }
            
            // Fechar modal e recarregar grupos
            hideNewGroupModal();
            loadGroups();
            
        } catch (error) {
            console.error('Erro ao criar grupo:', error);
        }
    }
    
    // Funções auxiliares
    function formatDate(dateString) {
        const date = new Date(dateString);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
});