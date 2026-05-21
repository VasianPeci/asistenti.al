import { v1beta1 } from "@google-cloud/aiplatform";
import { GoogleAuth } from "google-auth-library";
import { env } from "../config/env";

const { VertexRagDataServiceClient, VertexRagServiceClient } = v1beta1;

export type RagDataClient = InstanceType<typeof VertexRagDataServiceClient>;
export type RagServiceClient = InstanceType<typeof VertexRagServiceClient>;

const apiEndpoint = `${env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com`;

let dataClient: RagDataClient | null = null;
let serviceClient: RagServiceClient | null = null;
let auth: GoogleAuth | null = null;

export function getRagDataClient(): RagDataClient {
  if (!dataClient) {
    dataClient = new VertexRagDataServiceClient({ apiEndpoint });
  }
  return dataClient;
}

export function getRagServiceClient(): RagServiceClient {
  if (!serviceClient) {
    serviceClient = new VertexRagServiceClient({ apiEndpoint });
  }
  return serviceClient;
}

export function getAuth(): GoogleAuth {
  if (!auth) {
    auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return auth;
}

export function locationPath(): string {
  return `projects/${env.GOOGLE_CLOUD_PROJECT}/locations/${env.GOOGLE_CLOUD_LOCATION}`;
}

export function apiBaseUrl(): string {
  return `https://${apiEndpoint}/v1beta1`;
}
