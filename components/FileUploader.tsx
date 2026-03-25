import React from "react";
import type { LucideIcon } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type FileUploaderProps = {
  control: any;
  name: string;
  label: string;
  acceptTypes: string[];
  icon: LucideIcon;
  placeholder: string;
  hint: string;
  disabled?: boolean;
};

const FileUploader = ({
  control,
  name,
  label,
  acceptTypes,
  icon: Icon,
  placeholder,
  hint,
  disabled = false,
}: FileUploaderProps) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const file = field.value as File | undefined;
        return (
          <FormItem>
            <FormLabel className="form-label">{label}</FormLabel>
            <FormControl>
              <label
                className={`upload-dropzone ${file ? "upload-dropzone-uploaded" : ""}`}
              >
                <input
                  type="file"
                  accept={acceptTypes.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0];
                    field.onChange(selectedFile ?? undefined);
                  }}
                  disabled={disabled}
                />
                <Icon className="upload-dropzone-icon" />
                <p className="upload-dropzone-text">
                  {file ? file.name : placeholder}
                </p>
                <p className="upload-dropzone-hint">{hint}</p>
              </label>
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};

export default FileUploader;
