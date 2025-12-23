// auth.js
// Работа с пользователями

import { supabase } from './supabase-config.js';

// Текущий пользователь
let currentUser = null;

// ====================
// РЕГИСТРАЦИЯ
// ====================

async function registerUser(username, password) {
    try {
        console.log(`📝 Регистрация пользователя: ${username}`);
        
        // 1. Регистрация в Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: `${username}@autostop.com`,
            password: password,
            options: {
                data: {
                    username: username
                }
            }
        });
        
        if (authError) throw authError;
        
        // 2. Создание записи в таблице users
        const { error: dbError } = await supabase
            .from('users')
            .insert([{
                id: authData.user.id,
                username: username,
                email: `${username}@autostop.com`,
                created_at: new Date().toISOString()
            }]);
        
        if (dbError) {
            console.warn('Предупреждение при создании записи:', dbError.message);
            // Продолжаем, даже если ошибка - пользователь зарегистрирован в Auth
        }
        
        console.log('✅ Пользователь зарегистрирован:', username);
        return { success: true, user: authData.user };
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error.message);
        return { success: false, error: error.message };
    }
}

// ====================
// ВХОД
// ====================

async function loginUser(username, password) {
    try {
        console.log(`🔑 Вход пользователя: ${username}`);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${username}@autostop.com`,
            password: password
        });
        
        if (error) throw error;
        
        // Получаем информацию о пользователе
        const { data: userData } = await supabase
            .from('users')
            .select('username, minecraft_skin')
            .eq('id', data.user.id)
            .single();
        
        currentUser = {
            id: data.user.id,
            username: userData?.username || username,
            skin: userData?.minecraft_skin
        };
        
        console.log('✅ Вход успешен:', currentUser);
        return { success: true, user: currentUser };
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error.message);
        return { success: false, error: error.message };
    }
}

// ====================
// ВЫХОД
// ====================

async function logoutUser() {
    try {
        await supabase.auth.signOut();
        currentUser = null;
        console.log('👋 Пользователь вышел');
        return { success: true };
    } catch (error) {
        console.error('❌ Ошибка выхода:', error.message);
        return { success: false, error: error.message };
    }
}

// ====================
// ПРОВЕРКА СЕССИИ
// ====================

async function checkSession() {
    try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (data.session) {
            const { data: userData } = await supabase
                .from('users')
                .select('username, minecraft_skin')
                .eq('id', data.session.user.id)
                .single();
            
            currentUser = {
                id: data.session.user.id,
                username: userData?.username || data.session.user.email.split('@')[0],
                skin: userData?.minecraft_skin
            };
            
            console.log('🔍 Сессия найдена:', currentUser);
            return { success: true, user: currentUser };
        }
        
        console.log('🔍 Пользователь не авторизован');
        return { success: false, user: null };
        
    } catch (error) {
        console.error('❌ Ошибка проверки сессии:', error.message);
        return { success: false, error: error.message };
    }
}

// ====================
// СЛУШАТЕЛЬ ИЗМЕНЕНИЙ АВТОРИЗАЦИИ
// ====================

supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Изменение состояния авторизации:', event);
    
    if (session) {
        // Пользователь вошёл
        supabase
            .from('users')
            .select('username, minecraft_skin')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
                currentUser = {
                    id: session.user.id,
                    username: data?.username || session.user.email.split('@')[0],
                    skin: data?.minecraft_skin
                };
                
                // Событие для других скриптов
                document.dispatchEvent(new CustomEvent('user-logged-in', {
                    detail: { user: currentUser }
                }));
            });
    } else {
        // Пользователь вышел
        currentUser = null;
        document.dispatchEvent(new CustomEvent('user-logged-out'));
    }
});

// ====================
// ЭКСПОРТ
// ====================

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    checkSession, 
    currentUser,
    supabase
};

// Автоматическая проверка сессии при загрузке
window.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
});
