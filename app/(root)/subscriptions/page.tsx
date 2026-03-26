import {ClerkProvider, PricingTable} from "@clerk/nextjs";
import {ruRU} from "@clerk/localizations/ru-RU";

export default function SubscriptionsPage() {
    return (
        <div className="container wrapper py-10">
            <div className="flex flex-col items-center text-center mb-10">
                <h1 className="text-4xl font-bold font-serif mb-4">Выберите подписку</h1>
                <p className="text-muted-foreground max-w-2xl">
                    Обновитесь, чтобы получить доступ к большему количеству книг, более длительным сеансам и расширенным функциям.
                </p>
            </div>

                <div className="clerk-pricing-container">
                    <PricingTable />
                </div>
        </div>
    );
}