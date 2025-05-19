document.addEventListener('DOMContentLoaded', function() {
    // Elementos de autenticação
    const adminAuthContainer = document.getElementById('admin-auth-container');
    const adminContainer = document.getElementById('admin-container');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLoginError = document.getElementById('admin-login-error');
    const adminUsername = document.getElementById('admin-username');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    
    // Elementos de navegação
    const navItems = document.querySelectorAll('.admin-nav-item');
    const tabs = document.querySelectorAll('.admin-tab');
    
    // Elementos das tabelas
    const usersTableBody = document.getElementById('users-table-body');
    const messagesTableBody = document.getElementById('messages-table-body');
    const messageSearch = document.getElementById('message-search');
    
    // Elementos de estatísticas
    const totalUsers = document.getElementById('total-users');
    const totalMessages = document.getElementById('total-messages');
    const totalGroups = document.getElementById('total-groups');
    
    // Elementos do modal de edição
    const editUserModal = document.getElementById('edit-user-modal');
    const closeEditModal = document.getElementById('close-edit-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const editUserId = document.getElementById('edit-user-id');
    const editUsername = document.getElementById('edit-username');
    const editEmail = document.getElementById('edit-email');
    const editIsAdmin = document.getElementById('edit-is-admin');
    
    // Variáveis globais
    let currentUser = null;
    let usersData = [];
    let messagesData = [];
    
    // Inicialização
    init();
    
    function init() {
        // Verificar se o usuário admin está logado
        const token = localStorage.getItem('adminToken');
        const user = localStorage.getItem('adminUser');
        
        if (token && user) {
            currentUser = JSON.parse(user);
            
            // Verificar se o usuário é admin
            if (currentUser.isAdmin) {
                showAdminInterface();
                loadUsers();
                loadMessages();
                loadStats();
            } else {
                // Se não for admin, fazer logout
                handleAdminLogout();
            }
        }
        
        // Eventos de autenticação
        adminLoginForm.addEventListener('submit', handleAdminLogin);
        adminLogoutBtn.addEventListener('click', handleAdminLogout);
        
        // Eventos de navegação
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // Eventos do modal
        closeEditModal.addEventListener('click', hideEditUserModal);
        editUserForm.addEventListener('submit', handleEditUser);
        
        // Eventos de busca
        messageSearch.addEventListener('input', filterMessages);
    }
    
    // Funções de autenticação
    async function handleAdminLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        
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
            
            // Verificar se o usuário é admin
            if (!data.user.isAdmin) {
                throw new Error('Acesso negado. Você não tem privilégios de administrador.');
            }
            
            // Armazenar dados de autenticação
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            currentUser = data.user;
            
            // Mostrar interface de admin
            showAdminInterface();
            loadUsers();
            loadMessages();
            loadStats();
            
        } catch (error) {
            adminLoginError.textContent = error.message;
        }
    }
    
    function handleAdminLogout() {
        // Limpar dados da sessão
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        currentUser = null;
        
        // Mostrar tela de login
        showAdminLoginInterface();
    }
    
    // Funções de inicialização da interface
    function showAdminInterface() {
        adminAuthContainer.style.display = 'none';
        adminContainer.style.display = 'block';
        
        // Atualiza a interface com dados do usuário
        adminUsername.textContent = currentUser.username;
    }
    
    function showAdminLoginInterface() {
        adminContainer.style.display = 'none';
        adminAuthContainer.style.display = 'flex';
        
        // Limpar formulário
        adminLoginForm.reset();
        adminLoginError.textContent = '';
    }
    
    // Funções de navegação
    function switchTab(tabId) {
        // Remover classe ativa de todos os itens e tabs
        navItems.forEach(item => item.classList.remove('active'));
        tabs.forEach(tab => tab.classList.remove('active'));
        
        // Adicionar classe ativa ao item e tab correspondentes
        document.querySelector(`.admin-nav-item[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(tabId).classList.add('active');
    }
    
    // Funções de dados
    async function loadUsers() {
        try {
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar usuários');
            }
            
            const users = await response.json();
            usersData = users;
            
            renderUsersTable(users);
            
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }
    
    async function loadMessages() {
        try {
            // Esta rota deve retornar todas as mensagens (implementar no servidor)
            const response = await fetch('/api/admin/messages', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar mensagens');
            }
            
            const messages = await response.json();
            messagesData = messages;
            
            renderMessagesTable(messages);
            
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
            // Para o exemplo, vamos simular mensagens
            const mockMessages = [];
            renderMessagesTable(mockMessages);
        }
    }
    
    async function loadStats() {
        try {
            // Esta rota deve retornar estatísticas do sistema (implementar no servidor)
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar estatísticas');
            }
            
            const stats = await response.json();
            
            // Atualizar contadores
            totalUsers.textContent = stats.totalUsers;
            totalMessages.textContent = stats.totalMessages;
            totalGroups.textContent = stats.totalGroups;
            
            // Renderizar gráficos
            renderCharts(stats);
            
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            // Para o exemplo, vamos simular estatísticas
            totalUsers.textContent = usersData.length;
            totalMessages.textContent = '0';
            totalGroups.textContent = '0';
            
            // Simulação de gráficos
            const usersChart = document.getElementById('users-chart');
            const messagesChart = document.getElementById('messages-chart');
            
            usersChart.innerHTML = `<div class="chart-placeholder">Dados insuficientes para exibir o gráfico</div>`;
            messagesChart.innerHTML = `<div class="chart-placeholder">Dados insuficientes para exibir o gráfico</div>`;
        }
    }
    
    // Funções de renderização
    function renderUsersTable(users) {
        usersTableBody.innerHTML = '';
        
        if (users.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="6" style="text-align: center;">Nenhum usuário encontrado</td>`;
            usersTableBody.appendChild(emptyRow);
            return;
        }
        
        users.forEach(user => {
            const row = document.createElement('tr');
            
            const createdAt = new Date(user.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${user.is_admin ? 'Sim' : 'Não'}</td>
                <td>${createdAt}</td>
                <td class="user-actions">
                    <button class="edit-btn" data-id="${user.id}">Editar</button>
                    <button class="delete-btn" data-id="${user.id}">Excluir</button>
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
        
        // Adicionar eventos aos botões
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-id');
                showEditUserModal(userId);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.getAttribute('data-id');
                confirmDeleteUser(userId);
            });
        });
    }
    
    function renderMessagesTable(messages) {
        messagesTableBody.innerHTML = '';
        
        if (messages.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td colspan="7" style="text-align: center;">Nenhuma mensagem encontrada</td>`;
            messagesTableBody.appendChild(emptyRow);
            return;
        }
        
        messages.forEach(message => {
            const row = document.createElement('tr');
            
            const createdAt = new Date(message.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Buscar nomes de usuários (em casos reais, o backend já enviaria estes dados)
            const senderName = getUserNameById(message.sender_id);
            const receiverName = message.receiver_id ? getUserNameById(message.receiver_id) : '-';
            const groupName = message.group_id ? `Grupo #${message.group_id}` : '-';
            
            const destination = message.group_id ? groupName : receiverName;
            
            row.innerHTML = `
                <td>${message.id}</td>
                <td>${senderName}</td>
                <td>${destination}</td>
                <td>${message.content}</td>
                <td>${message.image_url ? `<img src="${message.image_url}" alt="Imagem" width="50">` : '-'}</td>
                <td>${createdAt}</td>
                <td class="message-actions">
                    <button class="view-btn" data-id="${message.id}">Ver</button>
                    <button class="delete-btn" data-id="${message.id}">Excluir</button>
                </td>
            `;
            
            messagesTableBody.appendChild(row);
        });
        
        // Adicionar eventos aos botões
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const messageId = btn.getAttribute('data-id');
                viewMessage(messageId);
            });
        });
        
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const messageId = btn.getAttribute('data-id');
                confirmDeleteMessage(messageId);
            });
        });
    }
    
    function renderCharts(stats) {
        // Implementação simplificada de gráficos
        // Em um aplicativo real, você usaria bibliotecas como Chart.js
        
        const usersChart = document.getElementById('users-chart');
        const messagesChart = document.getElementById('messages-chart');
        
        // Exemplo simples de gráfico de barras com CSS
        let usersChartHTML = '<div class="simple-chart">';
        stats.userRegistrations.forEach(item => {
            const height = (item.count / stats.maxUserRegistration) * 100;
            usersChartHTML += `
                <div class="chart-bar-container">
                    <div class="chart-bar" style="height: ${height}%"></div>
                    <div class="chart-label">${item.date}</div>
                </div>
            `;
        });
        usersChartHTML += '</div>';
        
        let messagesChartHTML = '<div class="simple-chart">';
        stats.messageActivity.forEach(item => {
            const height = (item.count / stats.maxMessageActivity) * 100;
            messagesChartHTML += `
                <div class="chart-bar-container">
                    <div class="chart-bar" style="height: ${height}%"></div>
                    <div class="chart-label">${item.date}</div>
                </div>
            `;
        });
        messagesChartHTML += '</div>';
        
        usersChart.innerHTML = usersChartHTML;
        messagesChart.innerHTML = messagesChartHTML;
        
        // Adicionar estilos para os gráficos
        const style = document.createElement('style');
        style.textContent = `
            .simple-chart {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                height: 100%;
                width: 100%;
                padding-bottom: 20px;
            }
            
            .chart-bar-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                height: 100%;
            }
            
            .chart-bar {
                width: 30px;
                background-color: var(--primary-color);
                border-radius: 4px 4px 0 0;
                min-height: 5px;
            }
            
            .chart-label {
                margin-top: 8px;
                font-size: 0.8rem;
                color: var(--text-light);
                transform: rotate(-45deg);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Funções de gerenciamento de usuários
    function showEditUserModal(userId) {
        const user = usersData.find(u => u.id === parseInt(userId));
        
        if (!user) {
            return;
        }
        
        editUserId.value = user.id;
        editUsername.value = user.username;
        editEmail.value = user.email;
        editIsAdmin.checked = user.is_admin;
        
        editUserModal.style.display = 'flex';
    }
    
    function hideEditUserModal() {
        editUserModal.style.display = 'none';
        editUserForm.reset();
    }
    
    async function handleEditUser(e) {
        e.preventDefault();
        
        const userId = editUserId.value;
        const username = editUsername.value;
        const email = editEmail.value;
        const is_admin = editIsAdmin.checked;
        
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({ username, email, is_admin })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao atualizar usuário');
            }
            
            // Fechar modal e recarregar usuários
            hideEditUserModal();
            await loadUsers();
            
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
        }
    }
    
    function confirmDeleteUser(userId) {
        if (confirm('Tem certeza que deseja excluir este usuário?')) {
            deleteUser(userId);
        }
    }
    
    async function deleteUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao excluir usuário');
            }
            
            // Recarregar usuários
            await loadUsers();
            
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
        }
    }
    
    // Funções de gerenciamento de mensagens
    function viewMessage(messageId) {
        // Implementar visualização detalhada de mensagem
        alert(`Visualização da mensagem ${messageId} (a ser implementado)`);
    }
    
    function confirmDeleteMessage(messageId) {
        if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
            deleteMessage(messageId);
        }
    }
    
    async function deleteMessage(messageId) {
        try {
            const response = await fetch(`/api/admin/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao excluir mensagem');
            }
            
            // Recarregar mensagens
            await loadMessages();
            
        } catch (error) {
            console.error('Erro ao excluir mensagem:', error);
            // Atualizar a tabela para simular a exclusão
            messagesData = messagesData.filter(message => message.id !== parseInt(messageId));
            renderMessagesTable(messagesData);
        }
    }
    
    // Funções de filtro
    function filterMessages() {
        const searchTerm = messageSearch.value.toLowerCase();
        
        if (!searchTerm) {
            renderMessagesTable(messagesData);
            return;
        }
        
        const filteredMessages = messagesData.filter(message => {
            // Buscar nomes para comparação
            const senderName = getUserNameById(message.sender_id).toLowerCase();
            const receiverName = message.receiver_id ? getUserNameById(message.receiver_id).toLowerCase() : '';
            const content = message.content ? message.content.toLowerCase() : '';
            
            return senderName.includes(searchTerm) ||
                   receiverName.includes(searchTerm) ||
                   content.includes(searchTerm);
        });
        
        renderMessagesTable(filteredMessages);
    }
    
    // Funções utilitárias
    function getUserNameById(userId) {
        const user = usersData.find(u => u.id === parseInt(userId));
        return user ? user.username : `Usuário #${userId}`;
    }
});