import React from 'react'
import UploadForm from "@/components/UploadForm";

const Page = () => {
    return (
        <main className="new-book">
            <section className="flex flex-col gap-5 text-center mt-10">
                <h1 className="page-title-xl">Добавьте новую книгу</h1>
                <p className="subtitle">Загрузите PDF-файл, чтобы создать свой интерактивный опыт чтения</p>
            </section>

            <UploadForm />
        </main>
    )
}
export default Page
