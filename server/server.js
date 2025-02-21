const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
// 配置CORS和静态文件服务
app.use(cors());
app.use(express.json());

// DeepSeek R1 API配置
const API_KEY = process.env.API_KEY;
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 系统提示词
const SYSTEM_PROMPT = `你是一位专业的Life Coach，拥有丰富的人生经验和心理学知识。你的目标是通过对话帮助用户成长，给出有价值的建议。

请遵循以下原则：
1. 以同理心倾听用户的问题
2. 提供具体、可行的建议
3. 鼓励用户积极思考和行动
4. 保持专业、友善的对话态度
5. 在必要时提供相关的学习资源`;

// 处理聊天请求
app.post('/chat', async (req, res) => {
    // 设置响应头以支持流式输出
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            throw new Error('消息内容不能为空');
        }

        console.log('开始处理聊天请求:', { userMessage });

        // 准备API请求
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-r1-250120',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                stream: true
            }),
            timeout: 60000 // 60秒超时
        });

        console.log('API响应状态:', response.status, response.statusText);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('API请求失败:', {
                status: response.status,
                statusText: response.statusText,
                errorBody
            });
            throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorBody}`);
        }

        // 发送初始响应
        res.write(`data: {"content": "正在思考中..."}

`);

        // 处理流式响应
        const decoder = new TextDecoder();
        let buffer = '';
        
        // 使用for await...of来处理ReadableStream
        for await (const chunk of response.body) {

            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保存不完整的行

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

                const data = trimmedLine.slice(5).trim();
                if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    continue;
                }

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                        const content = parsed.choices[0].delta.content || '';
                        if (content) {
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    }
                } catch (e) {
                    console.error('解析响应数据失败:', e, '\n数据:', data);
                    continue;
                }
            }
        }

        res.end();
    } catch (error) {
        console.error('处理请求失败:', error);
        const errorMessage = error.message || '服务器内部错误';
        
        // 如果响应头已经发送，则发送错误事件
        if (res.headersSent) {
            res.write(`data: {"error": "${errorMessage}"}

`);
            res.end();
        } else {
            // 否则发送标准的错误响应
            res.status(500).json({
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

// 启动服务器
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});