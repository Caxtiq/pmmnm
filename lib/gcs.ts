/*
 * Copyright 2025 PKA-OpenLD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL,
    private_key: process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const bucketName = process.env.GCS_BUCKET_NAME!;
const bucket = storage.bucket(bucketName);

export async function uploadImage(
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const blob = bucket.file(`reports/${Date.now()}-${filename}`);
  
  await blob.save(file, {
    contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  await blob.makePublic();

  return `https://storage.googleapis.com/${bucketName}/${blob.name}`;
}

export async function deleteImage(imageUrl: string): Promise<void> {
  const filename = imageUrl.split(`${bucketName}/`)[1];
  if (filename) {
    await bucket.file(filename).delete();
  }
}

export { bucket, storage };
