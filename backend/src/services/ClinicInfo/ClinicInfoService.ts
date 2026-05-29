import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const FILE_PATH = join(__dirname, "..", "..", "..", "public", "clinic-info.md");

export const getClinicInfo = async (): Promise<string> => {
  try {
    return await readFile(FILE_PATH, "utf-8");
  } catch {
    return "";
  }
};

export const updateClinicInfo = async (content: string): Promise<void> => {
  await writeFile(FILE_PATH, content, "utf-8");
};
