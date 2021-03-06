// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Context } from "mocha";
import * as dotenv from "dotenv";
import * as path from "path";

import { env, Recorder, record, RecorderEnvironmentSetup } from "@azure/test-utils-recorder";
import { TokenCredential, ClientSecretCredential } from "@azure/identity";
import { isNode } from "@azure/core-http";

import { TextAnalyticsApiKeyCredential, TextAnalyticsClient } from "../../src/index";

if (isNode) {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
}

export interface RecordedClient {
  client: TextAnalyticsClient;
  recorder: Recorder;
}

const replaceableVariables: { [k: string]: string } = {
  AZURE_CLIENT_ID: "azure_client_id",
  AZURE_CLIENT_SECRET: "azure_client_secret",
  AZURE_TENANT_ID: "azure_tenant_id",
  TEXT_ANALYTICS_API_KEY: "api_key",
  // Second API key
  TEXT_ANALYTICS_API_KEY_ALT: "api_key_alt",
  ENDPOINT: "https://endpoint/"
};

export const testEnv = new Proxy(replaceableVariables, {
  get: (target, key: string) => {
    return env[key] || target[key];
  }
});

export const environmentSetup: RecorderEnvironmentSetup = {
  replaceableVariables,
  customizationsOnRecordings: [
    (recording: string): string =>
      recording.replace(/"access_token"\s?:\s?"[^"]*"/g, `"access_token":"access_token"`),
    // If we put ENDPOINT in replaceableVariables above, it will not capture
    // the endpoint string used with nock, which will be expanded to
    // https://<endpoint>:443/ and therefore will not match, so we have to do
    // this instead.
    (recording: string): string => {
      const match = testEnv.ENDPOINT.replace(/^https:\/\//, "").replace(/\/$/, "");
      return recording.replace(match, "endpoint");
    }
  ],
  queryParametersToSkip: []
};

export function createRecordedClient(
  context: Context,
  apiKey?: TextAnalyticsApiKeyCredential
): RecordedClient {
  const recorder = record(context, environmentSetup);

  let credential: TextAnalyticsApiKeyCredential | TokenCredential;
  if (apiKey !== undefined) {
    credential = apiKey;
  } else {
    credential = new ClientSecretCredential(
      testEnv.AZURE_TENANT_ID,
      testEnv.AZURE_CLIENT_ID,
      testEnv.AZURE_CLIENT_SECRET
    );
  }

  return {
    client: new TextAnalyticsClient(testEnv.ENDPOINT, credential),
    recorder
  };
}
