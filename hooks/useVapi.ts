'use client';

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import { useAuth } from '@clerk/nextjs';

// import { useSubscription } from '@/hooks/useSubscription';
import { ASSISTANT_ID, DEFAULT_VOICE, VOICE_SETTINGS } from '@/lib/constants';
import { getVoice } from '@/lib/utils';
import { IBook, Messages } from '@/types';
import { startVoiceSession, endVoiceSession } from '@/lib/actions/session.actions';
import {useSubscription} from "@/hooks/useSubscription";

export function useLatestRef<T>(value: T) {
    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref;
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;

let vapi: InstanceType<typeof Vapi>;
function getVapi() {
    if (!vapi) {
        if (!VAPI_API_KEY) {
            throw new Error('NEXT_PUBLIC_VAPI_API_KEY environment variable is not set');
        }
        vapi = new Vapi(VAPI_API_KEY);
    }
    return vapi;
}

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

export function useVapi(book: IBook) {
    const { userId } = useAuth();
    const { limits } = useSubscription();

    const [status, setStatus] = useState<CallStatus>('idle');
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentUserMessage, setCurrentUserMessage] = useState('');
    const [textMessages, setTextMessages] = useState<Messages[]>([]);
    const [textCurrentMessage, setTextCurrentMessage] = useState('');
    const [isTextSending, setIsTextSending] = useState(false);
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);
    const [isBillingError, setIsBillingError] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const textSessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef(false);

    // Keep refs in sync with latest values for use in callbacks
    const maxDurationSeconds = limits?.maxDurationPerSession ? limits.maxDurationPerSession * 60 : (15 * 60);
    const maxDurationRef = useLatestRef(maxDurationSeconds);
    const durationRef = useLatestRef(duration);
    const voice = book.persona || DEFAULT_VOICE;

    useEffect(() => {
        setTextMessages([]);
        setTextCurrentMessage('');
        setIsTextSending(false);
        textSessionIdRef.current = null;
    }, [book._id]);

    const endTrackedVoiceSession = useCallback((sessionId: string) => {
        endVoiceSession(sessionId, durationRef.current).catch((err) =>
            console.error('Failed to end voice session:', err),
        );
    }, [durationRef]);

    // Set up Vapi event listeners
    useEffect(() => {
        const handlers = {
            'call-start': () => {
                isStoppingRef.current = false;
                setStatus('starting'); // AI speaks first, wait for it
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Start duration timer
                startTimeRef.current = Date.now();
                setDuration(0);
                timerRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const newDuration = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
                        setDuration(newDuration);

                        // Check duration limit
                        if (newDuration >= maxDurationRef.current) {
                            getVapi().stop();
                            setLimitError(
                                `Достигнут лимит времени сессии (${Math.floor(
                                    maxDurationRef.current / SECONDS_PER_MINUTE,
                                )} минут). Обновите тариф для более длительных сессий.`,
                            );
                        }
                    }
                }, TIMER_INTERVAL_MS);
            },

            'call-end': () => {
                // Don't reset isStoppingRef here - delayed events may still fire
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Stop timer
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // End session tracking
                if (sessionIdRef.current) {
                    endTrackedVoiceSession(sessionIdRef.current);
                    sessionIdRef.current = null;
                }

                startTimeRef.current = null;
            },

            'speech-start': () => {
                if (!isStoppingRef.current) {
                    setStatus('speaking');
                }
            },
            'speech-end': () => {
                if (!isStoppingRef.current) {
                    // After AI finishes speaking, user can talk
                    setStatus('listening');
                }
            },

            message: (message: {
                type: string;
                role: string;
                transcriptType: string;
                transcript: string;
            }) => {
                if (message.type !== 'transcript') return;

                // User finished speaking → AI is thinking
                if (message.role === 'user' && message.transcriptType === 'final') {
                    if (!isStoppingRef.current) {
                        setStatus('thinking');
                    }
                    setCurrentUserMessage('');
                }

                // Partial user transcript → show real-time typing
                if (message.role === 'user' && message.transcriptType === 'partial') {
                    setCurrentUserMessage(message.transcript);
                    return;
                }

                // Partial AI transcript → show word-by-word
                if (message.role === 'assistant' && message.transcriptType === 'partial') {
                    setCurrentMessage(message.transcript);
                    return;
                }

                // Final transcript → add to messages
                if (message.transcriptType === 'final') {
                    if (message.role === 'assistant') setCurrentMessage('');
                    if (message.role === 'user') setCurrentUserMessage('');

                    setMessages((prev) => {
                        const isDupe = prev.some(
                            (m) => m.role === message.role && m.content === message.transcript,
                        );
                        return isDupe ? prev : [...prev, { role: message.role, content: message.transcript }];
                    });
                }
            },

            error: (error: Error) => {
                console.error('Vapi error:', error);
                // Don't reset isStoppingRef here - delayed events may still fire
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Stop timer on error
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // End session tracking on error
                if (sessionIdRef.current) {
                    endTrackedVoiceSession(sessionIdRef.current);
                    sessionIdRef.current = null;
                }

                // Show user-friendly error message
                const errorMessage = error.message?.toLowerCase() || '';
                if (errorMessage.includes('timeout') || errorMessage.includes('silence')) {
                    setLimitError('Сессия завершена из-за неактивности. Нажмите на микрофон, чтобы начать снова.');
                } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                    setLimitError('Соединение потеряно. Проверьте интернет и попробуйте снова.');
                } else {
                    setLimitError('Сессия завершилась неожиданно. Нажмите на микрофон, чтобы начать снова.');
                }

                startTimeRef.current = null;
            },
        };

        // Register all handlers
        Object.entries(handlers).forEach(([event, handler]) => {
            getVapi().on(event as keyof typeof handlers, handler as () => void);
        });

        return () => {
            // End active session on unmount
            if (sessionIdRef.current) {
                getVapi().stop();
                endTrackedVoiceSession(sessionIdRef.current);
                sessionIdRef.current = null;
            }
            // Cleanup handlers
            Object.entries(handlers).forEach(([event, handler]) => {
                getVapi().off(event as keyof typeof handlers, handler as () => void);
            });
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [endTrackedVoiceSession, maxDurationRef]);

    const start = useCallback(async () => {
        if (!userId) {
            setLimitError('Пожалуйста, войдите в аккаунт, чтобы начать голосовую сессию.');
            return;
        }

        setLimitError(null);
        setIsBillingError(false);
        setStatus('connecting');

        try {
            // Check session limits and create session record
            const result = await startVoiceSession(userId, book._id);

            if (!result.success) {
                setLimitError(
                    result.isBillingError
                        ? 'Достигнут лимит сессий по вашему тарифу. Пожалуйста, обновите тариф.'
                        : 'Не удалось начать голосовую сессию. Пожалуйста, попробуйте снова.',
                );
                setIsBillingError(!!result.isBillingError);
                setStatus('idle');
                return;
            }

            sessionIdRef.current = result.sessionId || null;
            // Note: Server-returned maxDurationMinutes is informational only
            // The actual limit is enforced by useLatestRef(limits.maxSessionMinutes * 60)

            const firstMessage = `Привет! Рад встрече. Перед тем как мы начнем — ты уже читал ${book.title}, или мы начинаем с чистого листа?`;

            await getVapi().start(ASSISTANT_ID, {
                firstMessage,
                variableValues: {
                    title: book.title,
                    author: book.author,
                    bookId: book._id,
                },
                voice: {
                    provider: '11labs' as const,
                    voiceId: getVoice(voice).id,
                    model: 'eleven_turbo_v2_5' as const,
                    stability: VOICE_SETTINGS.stability,
                    similarityBoost: VOICE_SETTINGS.similarityBoost,
                    style: VOICE_SETTINGS.style,
                    useSpeakerBoost: VOICE_SETTINGS.useSpeakerBoost,
                },
            });
        } catch (err) {
            console.error('Failed to start call:', err);
            setStatus('idle');
            setLimitError('Не удалось начать голосовую сессию. Пожалуйста, попробуйте снова.');
        }
    }, [book._id, book.title, book.author, voice, userId]);

    const stop = useCallback(() => {
        isStoppingRef.current = true;
        getVapi().stop();
    }, []);

    const sendText = useCallback(async (message: string) => {
        const trimmedMessage = message.trim();
        if (!trimmedMessage || isTextSending) return;

        setTextMessages((prev) => [...prev, { role: 'user', content: trimmedMessage }]);
        setTextCurrentMessage('Ищу ответ...');
        setIsTextSending(true);

        try {
            const response = await fetch('/api/book-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: book._id,
                    message: trimmedMessage,
                    sessionId: textSessionIdRef.current,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error || 'Не удалось отправить текстовое сообщение');
            }

            textSessionIdRef.current = data.sessionId ?? textSessionIdRef.current;
            setTextCurrentMessage('');
            setTextMessages((prev) => [
                ...prev,
                { role: 'assistant', content: data.reply || 'Не удалось получить ответ.' },
            ]);
        } catch (error) {
            console.error('Failed to send text message:', error);
            setTextCurrentMessage('');
            setLimitError(
                error instanceof Error && error.message
                    ? error.message
                    : 'Не удалось получить ответ. Попробуйте еще раз.',
            );
        } finally {
            setIsTextSending(false);
        }
    }, [book._id, isTextSending]);

    const clearError = useCallback(() => {
        setLimitError(null);
        setIsBillingError(false);
    }, []);

    const isActive =
        status === 'starting' ||
        status === 'listening' ||
        status === 'thinking' ||
        status === 'speaking';

    // Calculate remaining time
    // const maxDurationSeconds = limits.maxSessionMinutes * SECONDS_PER_MINUTE;
    // const remainingSeconds = Math.max(0, maxDurationSeconds - duration);
    // const showTimeWarning =
    //     isActive && remainingSeconds <= TIME_WARNING_THRESHOLD && remainingSeconds > 0;

    return {
        status,
        isActive,
        messages,
        currentMessage,
        currentUserMessage,
        textMessages,
        textCurrentMessage,
        isTextSending,
        duration,
        start,
        stop,
        sendText,
        limitError,
        isBillingError,
        maxDurationSeconds,
        clearError,
    };
}

export default useVapi;
