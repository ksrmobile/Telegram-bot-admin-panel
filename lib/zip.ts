import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import archiver from "archiver";

const MAX_FILES = 5000;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB

export async function safeExtractZip(
  zipPath: string,
  targetDir: string
): Promise<void> {
  await fs.promises.mkdir(targetDir, { recursive: true });

  const directory = await unzipper.Open.file(zipPath);

  if (directory.files.length > MAX_FILES) {
    throw new Error("Zip has too many files");
  }

  let totalSize = 0;

  for (const file of directory.files) {
    const filePath = file.path;

    if (!filePath || file.type === "SymbolicLink") {
      throw new Error("Symlinks are not allowed in zip");
    }

    if (filePath.includes("..") || path.isAbsolute(filePath)) {
      throw new Error("Invalid path in zip entry");
    }

    totalSize += file.uncompressedSize || 0;
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new Error("Zip is too large to extract");
    }

    const destPath = path.join(targetDir, filePath);
    const normalizedDest = path.normalize(destPath);

    if (!normalizedDest.startsWith(path.normalize(targetDir))) {
      throw new Error("Path traversal detected during extraction");
    }

    if (file.type === "Directory") {
      await fs.promises.mkdir(normalizedDest, { recursive: true });
    } else if (file.type === "File") {
      await fs.promises.mkdir(path.dirname(normalizedDest), {
        recursive: true
      });
      const readStream = file.stream();
      const writeStream = fs.createWriteStream(normalizedDest, {
        flags: "w",
        mode: 0o644
      });
      await new Promise<void>((resolve, reject) => {
        readStream
          .pipe(writeStream)
          .on("finish", () => resolve())
          .on("error", reject);
      });
    }
  }
}

export async function createZipFromDirectory(
  sourceDir: string,
  outputPath: string
): Promise<void> {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  const finished = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    archive.on("error", reject);
  });

  archive.pipe(output);
  archive.directory(sourceDir, false);
  archive.finalize();

  await finished;
}

