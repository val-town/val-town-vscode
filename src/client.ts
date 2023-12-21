export type ValPrivacy = "public" | "private" | "unlisted";
export type BaseVal = {
  id: string;
  name: string;
  code: string;
  privacy: ValPrivacy;
  version: number;
  runStartAt: string;
  runEndAt: string;
  author: {
    id: string;
    username: string;
  };
};

export type Blob = {
  key: string;
  size: number;
  lastModified: string;
};

export type FullVal = BaseVal & {
  readme: string;
};

type Paginated<T> = {
  data: T[];
  links: {
    self: string;
    next?: string;
    prev?: string;
  };
};

export type Version = {
  valID: string;
  version: number;
  runStartAt: string;
  runEndAt: string;
};

const templates = {
  http: `export default async function (req: Request): Promise<Response> {
  return Response.json({ ok: true })
}`,
  email: `export default async function (email: Email) {

}`,
  cron: `export default async function (interval: Interval) {

}`,
};

export type ValTemplate = keyof typeof templates;

export class ValtownClient {
  private _uid: string | undefined;

  constructor(public endpoint: string, private token?: string) {}

  setToken(token?: string) {
    this.token = token;
  }

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }

  get authenticated() {
    return !!this.token;
  }

  async fetch(url: string, init?: RequestInit) {
    if (!this.token) {
      throw new Error("No token");
    }

    const headers = {
      ...init?.headers,
      Authorization: `Bearer ${this.token}`,
    };
    return fetch(url, {
      ...init,
      headers,
    });
  }

  async uid() {
    if (!this._uid) {
      const resp = await this.fetch(`${this.endpoint}/v1/me`);
      if (resp.status !== 200) {
        throw new Error("Failed to get user ID");
      }

      const body = (await resp.json()) as { id: string };

      this._uid = body.id;
    }

    return this._uid;
  }

  async createVal(template?: ValTemplate) {
    // empty vals are not allowed, so we add a space
    let code = template ? templates[template] : " ";
    if (template) {
      code = templates[template];
    }

    const resp = await this.fetch(`${this.endpoint}/v1/vals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    });
    if (!resp.ok) {
      throw new Error("Failed to create val");
    }

    return resp.json() as Promise<BaseVal>;
  }

  async listLikedVals() {
    let endpoint = `${this.endpoint}/v1/me/likes?limit=100`;
    const vals: BaseVal[] = [];

    while (true) {
      const resp = await this.fetch(endpoint);
      if (!resp.ok) {
        throw new Error("Failed to get liked vals");
      }

      const body = (await resp.json()) as Paginated<BaseVal>;
      vals.push(...body.data);
      if (!body.links.next) {
        break;
      }

      endpoint = body.links.next;
    }

    return vals;
  }

  async listMyVals() {
    const uid = await this.uid();
    let endpoint = `${this.endpoint}/v1/users/${uid}/vals?limit=100`;
    const vals = [] as BaseVal[];

    while (true) {
      const resp = await this.fetch(endpoint);
      if (!resp.ok) {
        throw new Error("Failed to get my vals");
      }
      const body = (await resp.json()) as Paginated<BaseVal>;
      vals.push(...body.data);

      if (!body.links.next) {
        break;
      }

      endpoint = body.links.next;
    }

    return vals;
  }

  async listBlobs(prefix?: string) {
    const resp = await this.fetch(
      prefix
        ? `${this.endpoint}/v1/blob?prefix=${encodeURIComponent(prefix)}`
        : `${this.endpoint}/v1/blob`
    );
    if (!resp.ok) {
      throw new Error("Failed to list blobs");
    }

    return resp.json() as Promise<Blob[]>;
  }

  async readBlob(key: string) {
    const resp = await this.fetch(
      `${this.endpoint}/v1/blob/${encodeURIComponent(key)}`
    );

    if (!resp.ok) {
      throw new Error("Failed to get blob");
    }

    return new Uint8Array(await resp.arrayBuffer());
  }

  async writeBlob(key: string, data: Uint8Array) {
    const resp = await this.fetch(
      `${this.endpoint}/v1/blob/${encodeURIComponent(key)}`,
      {
        method: "POST",
        body: data,
      }
    );

    if (!resp.ok) {
      throw new Error("Failed to write blob");
    }
  }

  async deleteBlob(key: string) {
    const resp = await this.fetch(
      `${this.endpoint}/v1/blob/${encodeURIComponent(key)}`,
      {
        method: "DELETE",
      }
    );

    if (!resp.ok) {
      throw new Error("Failed to delete blob");
    }
  }

  async copyBlob(oldKey: string, newKey: string) {
    const resp = await this.fetch(
      `https://api.val.town/v1/blob/${encodeURIComponent(oldKey)}`
    );
    await this.writeBlob(newKey, new Uint8Array(await resp.arrayBuffer()));
  }

  async renameBlob(oldKey: string, newKey: string) {
    await this.copyBlob(oldKey, newKey);
    await this.deleteBlob(oldKey);
  }

  async listVersions(valId: string) {
    let endpoint = `${this.endpoint}/v1/vals/${valId}/versions?limit=100`;
    const versions = [] as Version[];
    while (true) {
      const resp = await this.fetch(endpoint);
      if (!resp.ok) {
        throw new Error("Failed to get versions");
      }

      const body = (await resp.json()) as Paginated<Version>;
      versions.push(...body.data);

      if (!body.links.next) {
        break;
      }

      endpoint = body.links.next;
    }

    return versions;
  }

  async getVal(valId: string, version?: number) {
    const endpoint = version
      ? `${this.endpoint}/v1/vals/${valId}/versions/${version}`
      : `${this.endpoint}/v1/vals/${valId}`;
    const resp = await this.fetch(endpoint);

    if (!resp.ok) {
      throw new Error("Failed to get val");
    }

    return resp.json() as Promise<FullVal>;
  }

  async renameVal(valID: string, name: string) {
    const resp = await this.fetch(`${this.endpoint}/v1/vals/${valID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
      }),
    });

    if (!resp.ok) {
      throw new Error("Failed to rename val");
    }
  }

  async setPrivacy(valID: string, privacy: "public" | "unlisted" | "private") {
    const resp = await this.fetch(`${this.endpoint}/v1/vals/${valID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy,
      }),
    });

    if (!resp.ok) {
      throw new Error("Failed to set privacy");
    }
  }

  async writeVal(valID: string, code: string) {
    console.log("writing val", valID, code);
    const resp = await this.fetch(
      `${this.endpoint}/v1/vals/${valID}/versions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      }
    );

    if (!resp.ok) {
      throw new Error("Failed to write val");
    }
  }

  async deleteVal(valID: string) {
    const resp = await this.fetch(`${this.endpoint}/v1/vals/${valID}`, {
      method: "DELETE",
    });

    if (!resp.ok) {
      throw new Error("Failed to delete val");
    }
  }

  async resolveVal(username: string, valname: string) {
    const resp = await this.fetch(
      `${this.endpoint}/v1/alias/${username}/${valname}`
    );

    if (!resp.ok) {
      throw new Error("Failed to resolve val");
    }

    return resp.json();
  }
}
