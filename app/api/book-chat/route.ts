import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { connectToDatabase } from '@/database/mongoose';
import Book from '@/database/models/book.model';
import { ASSISTANT_ID } from '@/lib/constants';

type BookChatRequest = {
    bookId?: string;
    message?: string;
    sessionId?: string;
};

type VapiContentPart = {
    type?: string;
    text?: string;
};

type VapiOutputMessage = {
    role?: string;
    content?: VapiContentPart[];
};

type VapiWebChatResponse = {
    id?: string;
    sessionId?: string;
    output?: VapiOutputMessage[];
    message?: string;
};

const VAPI_API_URL = 'https://api.vapi.ai/chat/web';
const VAPI_API_KEY = process.env.VAPI_API_KEY ?? process.env.NEXT_PUBLIC_VAPI_API_KEY;

const getAssistantReply = (output: VapiOutputMessage[] | undefined) => {
    const assistantMessage = [...(output || [])].reverse().find((message) => message.role === 'assistant');
    if (!assistantMessage?.content?.length) return '';

    return assistantMessage.content
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text?.trim())
        .filter(Boolean)
        .join('\n')
        .trim();
};

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
        }

        if (!VAPI_API_KEY) {
            return NextResponse.json({ error: 'Vapi API key is not configured' }, { status: 500 });
        }

        const body = (await req.json()) as BookChatRequest;
        const bookId = body.bookId?.trim();
        const message = body.message?.trim();
        const sessionId = body.sessionId?.trim();

        if (!bookId || !message) {
            return NextResponse.json({ error: 'bookId и message обязательны' }, { status: 400 });
        }

        await connectToDatabase();

        const book = await Book.findById(bookId).select('_id title author persona').lean();
        if (!book) {
            return NextResponse.json({ error: 'Книга не найдена' }, { status: 404 });
        }

        const response = await fetch(VAPI_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                assistantId: ASSISTANT_ID,
                sessionId: sessionId || undefined,
                input: message,
                assistantOverrides: {
                    variableValues: {
                        bookId: String(book._id),
                        title: String(book.title),
                        author: String(book.author),
                        persona: String(book.persona || ''),
                    },
                },
            }),
        });

        const data = (await response.json()) as VapiWebChatResponse;

        if (!response.ok) {
            console.error('Vapi text chat error:', data);
            return NextResponse.json(
                { error: data.message || 'Не удалось получить ответ от Vapi' },
                { status: response.status },
            );
        }

        const reply = getAssistantReply(data.output);
        if (!reply) {
            return NextResponse.json(
                {
                    error: 'Vapi не вернул текстовый ответ ассистента',
                    sessionId: data.sessionId || sessionId || null,
                },
                { status: 502 },
            );
        }

        return NextResponse.json({
            reply,
            sessionId: data.sessionId || sessionId || null,
            chatId: data.id || null,
        });
    } catch (error) {
        console.error('Book text chat error:', error);
        return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
    }
}
