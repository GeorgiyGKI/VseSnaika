import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import HeroSection from "@/components/HeroSection";
import BookCard from "@/components/BookCard";
import {sampleBooks} from "@/lib/constants";
import Search from "@/components/Search";

const Page = async () => {
  const { userId } = await auth();

  return (
    <main className="wrapper container" data-signed-in={Boolean(userId)}>
        <HeroSection />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
            <h2 className="text-3xl font-serif font-bold text-[#212a3b]">Recent Books</h2>
            <Search />
        </div>

        <div className="library-books-grid">
            {sampleBooks.map((book) => (
                <BookCard key={book._id} title={book.title} author={book.author} coverURL={book.coverURL} slug={book.slug} />
            ))}
        </div>
    </main>
  );
};

export default Page;
