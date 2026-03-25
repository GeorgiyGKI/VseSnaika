import React from 'react'
import Image from "next/image";

const HeroSection = () => {
    return (
        <section className="wrapper pt-8 mb-10 md:mb-16">
            <div className="library-hero-card">
                <div className="library-hero-content lg:items-center lg:text-left lg:gap-12">
                    <div className="library-hero-text">
                        <h1 className="library-hero-title">Ваша библиотека</h1>
                        <p className="library-hero-description">
                            Превратите книги в интерактивные разговоры с ИИ. Слушайте,
                            учитесь и обсуждайте любимые истории.
                        </p>
                        <button
                            className="library-cta-primary border border-[var(--border-subtle)] shadow-soft-sm"
                            type="button"
                        >
                            <span className="text-xl leading-none">+</span>
                            <span>Добавить новую книгу</span>
                        </button>
                    </div>

                    <div className="library-hero-illustration-desktop">
                        <Image
                            src="/assets/hero-illustration.png"
                            alt="Винтажные книги и глобус"
                            width={380}
                            height={240}
                            className="w-full max-w-[380px] h-auto"
                            priority
                        />
                    </div>

                    <div className="library-steps-card shadow-soft-sm w-full max-w-[240px] border border-[var(--border-subtle)]">
                        <div className="library-step-item">
                            <div className="library-step-number">1</div>
                            <div>
                                <p className="library-step-title">Загрузите PDF</p>
                                <p className="library-step-description">Добавьте файл книги</p>
                            </div>
                        </div>
                        <div className="library-step-item mt-3">
                            <div className="library-step-number">2</div>
                            <div>
                                <p className="library-step-title">ИИ‑обработка</p>
                                <p className="library-step-description">Мы анализируем содержание</p>
                            </div>
                        </div>
                        <div className="library-step-item mt-3">
                            <div className="library-step-number">3</div>
                            <div>
                                <p className="library-step-title">Голосовой чат</p>
                                <p className="library-step-description">Обсуждайте с ИИ</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="library-hero-illustration">
                    <Image
                        src="/assets/hero-illustration.png"
                        alt="Винтажные книги и глобус"
                        width={320}
                        height={200}
                        className="w-full max-w-[320px] h-auto"
                        priority
                    />
                </div>
            </div>
        </section>
    )
}
export default HeroSection
