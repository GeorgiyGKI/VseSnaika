'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useClerk } from '@clerk/nextjs';

import useVapi from '@/hooks/useVapi';
import Transcript from '@/components/Transcript';
import { IBook } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type InteractionMode = 'voice' | 'text';

const VapiControls = ({ book }: { book: IBook }) => {
    const {
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
        clearError,
        limitError,
        isBillingError,
        maxDurationSeconds,
    } = useVapi(book);

    const router = useRouter();
    const { userId } = useAuth();
    const { openSignIn } = useClerk();

    const [mode, setMode] = useState<InteractionMode>('voice');
    const [textQuery, setTextQuery] = useState('');

    const promptLogin = () => {
        toast.error('Чтобы общаться с книгой, сначала авторизуйтесь через кнопку Логин.', {
            action: {
                label: 'Логин',
                onClick: () => openSignIn(),
            },
        });
    };

    useEffect(() => {
        if (limitError) {
            toast.error(limitError);
            if (isBillingError) {
                router.push('/subscriptions');
            } else {
                router.push('/');
            }
            clearError();
        }
    }, [isBillingError, limitError, router, clearError]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'connecting':
                return { label: 'Соединяюсь...', color: 'vapi-status-dot-connecting' };
            case 'starting':
                return { label: 'Начинаю...', color: 'vapi-status-dot-starting' };
            case 'listening':
                return { label: 'Слушаю', color: 'vapi-status-dot-listening' };
            case 'thinking':
                return { label: 'Думаю...', color: 'vapi-status-dot-thinking' };
            case 'speaking':
                return { label: 'Разговариваю', color: 'vapi-status-dot-speaking' };
            default:
                return { label: 'Готов', color: 'vapi-status-dot-ready' };
        }
    };

    const statusDisplay = getStatusDisplay();

    const handleModeChange = (nextMode: InteractionMode) => {
        if (nextMode === mode) return;

        if (nextMode === 'text' && isActive) {
            stop();
        }

        setMode(nextMode);
    };

    const handleTextSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!userId) {
            promptLogin();
            return;
        }

        const message = textQuery.trim();
        if (!message || isTextSending) return;

        setTextQuery('');
        await sendText(message);
    };

    const transcriptMessages = mode === 'voice' ? messages : textMessages;
    const transcriptCurrentMessage = mode === 'voice' ? currentMessage : textCurrentMessage;
    const transcriptCurrentUserMessage = mode === 'voice' ? currentUserMessage : '';

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
            <div className="vapi-header-card">
                <div className="vapi-cover-wrapper">
                    <Image
                        src={book.coverURL || '/images/book-placeholder.png'}
                        alt={book.title}
                        width={120}
                        height={180}
                        className="vapi-cover-image !w-[120px] !h-auto"
                        priority
                    />

                    {mode === 'voice' && (
                        <div className="vapi-mic-wrapper relative">
                            {isActive && (status === 'speaking' || status === 'thinking') && (
                                <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
                            )}
                            <button
                                onClick={() => {
                                    if (isActive) {
                                        stop();
                                        return;
                                    }

                                    if (!userId) {
                                        promptLogin();
                                        return;
                                    }

                                    start();
                                }}
                                disabled={status === 'connecting'}
                                className={`vapi-mic-btn shadow-md !w-[60px] !h-[60px] z-10 ${isActive ? 'vapi-mic-btn-active' : 'vapi-mic-btn-inactive'}`}
                            >
                                {isActive ? (
                                    <Mic className="size-7 text-white" />
                                ) : (
                                    <MicOff className="size-7 text-[#212a3b]" />
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 flex-1">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#212a3b] mb-1">
                            {book.title}
                        </h1>
                        <p className="text-[#3d485e] font-medium">от {book.author}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => handleModeChange('voice')}
                            className={`vapi-status-indicator ${mode === 'voice' ? 'ring-2 ring-[#212a3b]' : ''}`}
                        >
                            <span className="vapi-status-text">Голос</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleModeChange('text')}
                            className={`vapi-status-indicator ${mode === 'text' ? 'ring-2 ring-[#212a3b]' : ''}`}
                        >
                            <span className="vapi-status-text">Текст</span>
                        </button>

                        {mode === 'voice' && (
                            <>
                                <div className="vapi-status-indicator">
                                    <span className={`vapi-status-dot ${statusDisplay.color}`} />
                                    <span className="vapi-status-text">{statusDisplay.label}</span>
                                </div>

                                <div className="vapi-status-indicator">
                                    <span className="vapi-status-text">Голос: {book.persona || 'Даник'}</span>
                                </div>

                                <div className="vapi-status-indicator">
                                    <span className="vapi-status-text">
                                        {formatDuration(duration)}/{formatDuration(maxDurationSeconds)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="vapi-transcript-wrapper">
                <div className="transcript-container min-h-[400px]">
                    <Transcript
                        messages={transcriptMessages}
                        currentMessage={transcriptCurrentMessage}
                        currentUserMessage={transcriptCurrentUserMessage}
                    />
                </div>

                {mode === 'text' && (
                    <form onSubmit={handleTextSubmit} className="mt-4 flex gap-3 items-center">
                        <Input
                            type="text"
                            value={textQuery}
                            onChange={(e) => setTextQuery(e.target.value)}
                            placeholder="Задайте вопрос по книге текстом..."
                            disabled={isTextSending}
                            className="bg-white h-12"
                        />
                        <Button
                            color="indigo"
                            size="lg"
                            type="submit"
                            className="h-12"
                            disabled={isTextSending || !textQuery.trim()}
                        >
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 15 15"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M3.24182 2.32181C3.3919 2.23132 3.5784 2.22601 3.73338 2.30781L12.7334 7.05781C12.8974 7.14436 13 7.31457 13 7.5C13 7.68543 12.8974 7.85564 12.7334 7.94219L3.73338 12.6922C3.5784 12.774 3.3919 12.7687 3.24182 12.6782C3.09175 12.5877 3 12.4252 3 12.25V2.75C3 2.57476 3.09175 2.4123 3.24182 2.32181ZM4 3.57925V11.4207L11.4288 7.5L4 3.57925Z"
                                    fill="currentColor"
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                />
                            </svg>
                            {isTextSending ? 'Отправка...' : 'Отправить'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default VapiControls;
