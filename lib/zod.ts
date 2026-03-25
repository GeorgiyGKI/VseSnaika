import { z } from "zod";

import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_PDF_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
} from "@/lib/constants";

const pdfSchema = z
  .instanceof(File, { message: "PDF файл обязателен" })
  .refine((file) => ACCEPTED_PDF_TYPES.includes(file.type), {
    message: "Поддерживается только PDF",
  })
  .refine((file) => file.size <= MAX_FILE_SIZE, {
    message: "PDF файл должен быть меньше 50MB",
  });

const imageSchema = z
  .instanceof(File, { message: "Неверный файл изображения" })
  .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), {
    message: "Поддерживаются изображения JPG, PNG или WEBP",
  })
  .refine((file) => file.size <= MAX_IMAGE_SIZE, {
    message: "Изображение должно быть меньше 10MB",
  });

export const UploadSchema = z.object({
  title: z.string().min(2, "Введите название книги"),
  author: z.string().min(2, "Введите имя автора"),
  persona: z.string().min(1, "Выберите голос"),
  pdfFile: pdfSchema,
  coverImage: imageSchema.optional(),
});
