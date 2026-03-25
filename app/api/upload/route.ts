import { handleUpload } from "@vercel/blob";
import { NextResponse } from "next/server";

import { ACCEPTED_IMAGE_TYPES, ACCEPTED_PDF_TYPES } from "@/lib/constants";

export async function POST(request: Request) {
  const body = await request.json();

  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => {
      return {
        allowedContentTypes: [...ACCEPTED_PDF_TYPES, ...ACCEPTED_IMAGE_TYPES],
        tokenPayload: JSON.stringify({}),
      };
    },
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(response);
}
