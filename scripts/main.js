document.addEventListener('DOMContentLoaded', () => {
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const chatHistory = document.getElementById('chatHistory');
    const loading = document.getElementById('loading');

    // 处理表单提交
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;

        // 添加用户消息到对话历史
        appendMessage('user', message);
        messageInput.value = '';

        // 显示加载动画
        loading.classList.add('active');

        try {
            // 发送消息到后端并处理流式响应
            const response = await fetch('http://localhost:3000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('网络请求失败');
            }

            // 创建新的AI消息容器
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.className = 'message message--ai';
            const aiContentDiv = document.createElement('div');
            aiContentDiv.className = 'message__content';
            aiMessageDiv.appendChild(aiContentDiv);
            chatHistory.appendChild(aiMessageDiv);

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                aiResponse += parsed.content;
                                aiContentDiv.textContent = aiResponse;
                                // 滚动到最新消息
                                chatHistory.scrollTop = chatHistory.scrollHeight;
                            }
                        } catch (e) {
                            console.error('解析响应数据失败:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            appendMessage('ai', '抱歉，出现了一些问题。请稍后再试。');
        } finally {
            // 隐藏加载动画
            loading.classList.remove('active');
        }
    });

    // 添加消息到对话历史
    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message--${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message__content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(contentDiv);
        chatHistory.appendChild(messageDiv);
        
        // 滚动到最新消息
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
});