import type { R2BucketBinding } from "../../env.js";

export class ArtifactStorage {
  constructor(private readonly bucket: R2BucketBinding | undefined) {}

  async upload(
    requirementId: string,
    fileName: string,
    contentBase64: string,
    contentType: string,
  ): Promise<string> {
    const key = `${requirementId}/${Date.now()}-${fileName}`;
    const bytes = Uint8Array.from(atob(contentBase64), (char) =>
      char.charCodeAt(0),
    );
    await this.bucket?.put(key, bytes.buffer, {
      httpMetadata: { contentType },
    });
    return `r2://${key}`;
  }
}
