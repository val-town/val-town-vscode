export type ValPrivacy = "public" | "private" | "unlisted";
export type BaseVal = {
  id: string;
  name: string;
  code: string;
  privacy: ValPrivacy;
  version: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
  };
};

export type User = {
  id: string;
  bio: string;
  username: string;
  profileImageUrl: string;
};

// We patch these types to only support JSON values
export type InValue = null | string | number | boolean;
export type InArgs = Array<InValue> | Record<string, InValue>;
export type InStatement =
  | {
      sql: string;
      args: InArgs;
    }
  | string;

export type Blob = {
  key: string;
  size: number;
  lastModified: string;
};

export type FullVal = BaseVal & {
  readme: string;
  referenceCount: number;
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
  createdAt: string;
};

export type CompletionVal = {
  handle: string;
  name: string;
  author: string;
  createdAt: string;
  code: string;
  version: number;
  exportedName: string;
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
  private _user: User | undefined;

  constructor(
    public endpoint: string,
    private token?: string
  ) {}

  setToken(token?: string) {
    this.token = token;
  }

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }

  get authenticated() {
    return !!this.token;
  }

  async paginate(url: string | URL) {
    if (typeof url === "string") {
      url = new URL(url);
    }
    url.searchParams.set("limit", "100");

    const data = [];
    while (true) {
      const resp = await this.fetch(url);
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      const body = (await resp.json()) as Paginated<BaseVal>;
      data.push(...body.data);

      if (!body.links?.next) {
        break;
      }

      url = new URL(body.links?.next);
      if (url.protocol === "http:") {
        url.protocol = "https:";
      }
    }

    return data;
  }

  async fetch(url: string | URL, init?: RequestInit) {
    if (!this.token) {
      throw new Error("No token");
    }

    const { hostname, pathname } = new URL(url);
    if (
      hostname !== "api.val.town" &&
      !(hostname === "val.town" && pathname.startsWith("/api/"))
    ) {
      return fetch(url, init);
    }

    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  async user(): Promise<User> {
    if (!this._user) {
      const resp = await this.fetch(`${this.endpoint}/v1/me`);
      if (!resp.ok) {
        throw new Error(await resp.text());
      }

      const user = await resp.json();
      this._user = user;
      return user;
    }

    return this._user;
  }

  async createVal(options?: { template?: ValTemplate; privacy?: ValPrivacy }) {
    // empty vals are not allowed, so we add a space
    let code = options?.template ? templates[options?.template] : "\n";

    const resp = await this.fetch(`${this.endpoint}/v1/vals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        privacy: options?.privacy || "private",
      }),
    });
    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    return resp.json() as Promise<BaseVal>;
  }

  async listLikedVals() {
    let endpoint = `${this.endpoint}/v1/me/likes?limit=100`;
    const vals: BaseVal[] = [];

    while (true) {
      const resp = await this.fetch(endpoint);
      if (!resp.ok) {
        throw new Error(await resp.text());
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
    const user = await this.user();
    let endpoint = `${this.endpoint}/v1/users/${user.id}/vals?limit=100`;
    const vals = [] as BaseVal[];

    while (true) {
      const resp = await this.fetch(endpoint);
      if (!resp.ok) {
        throw new Error(await resp.text());
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
      throw new Error(await resp.text());
    }

    return resp.json() as Promise<Blob[]>;
  }

  async readBlob(key: string) {
    const resp = await this.fetch(
      `${this.endpoint}/v1/blob/${encodeURIComponent(key)}`
    );

    if (!resp.ok) {
      throw new Error(await resp.text());
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
      throw new Error(await resp.text());
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
      throw new Error(await resp.text());
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
        throw new Error(await resp.text());
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
      throw new Error(await resp.text());
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
      throw new Error(await resp.text());
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
      throw new Error(await resp.text());
    }
  }

  async writeVal(valID: string, code: string) {
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
      throw new Error(await resp.text());
    }
  }

  async writeReadme(valID: string, readme: string) {
    const resp = await this.fetch(`${this.endpoint}/v1/vals/${valID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        readme,
      }),
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }
  }

  async deleteVal(valID: string) {
    const resp = await this.fetch(`${this.endpoint}/v1/vals/${valID}`, {
      method: "DELETE",
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }
  }

  async searchVals(query: string) {
    return this.paginate(
      `${this.endpoint}/v1/search/vals?query=${encodeURIComponent(query)}`
    );
  }

  async resolveUser(username: string) {
    if (username.startsWith("@")) {
      username = username.slice(1);
    }

    const resp = await this.fetch(`${this.endpoint}/v1/alias/${username}`);
    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    return resp.json() as Promise<User>;
  }

  async resolveVal(username: string, valname: string) {
    if (username.startsWith("@")) {
      username = username.slice(1);
    }

    const resp = await this.fetch(
      `${this.endpoint}/v1/alias/${username}/${valname}`
    );

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    return resp.json() as Promise<FullVal>;
  }

  async extractDependencies(code: string) {
    const esmUrlRegex =
      /https:\/\/esm\.town\/v\/([a-zA-Z_$][0-9a-zA-Z_$]*)\/([a-zA-Z_$][0-9a-zA-Z_$]*)/g;

    const matches = [...code.matchAll(esmUrlRegex)];
    if (matches.length === 0) {
      return [];
    }

    const dependencies = await Promise.all(
      matches.flatMap(async (match) => {
        const [, author, name] = match;
        try {
          return await this.resolveVal(author, name);
        } catch (e) {
          return null;
        }
      })
    );

    return dependencies.filter((val): val is FullVal => !!val);
  }

  async execute(statement: InStatement) {
    const res = await this.fetch(`${this.endpoint}/v1/sqlite/execute`, {
      method: "POST",
      body: JSON.stringify({ statement }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return res.json();
  }

  async autocomplete(
    handle: string | undefined,
    name: string | undefined
  ): Promise<CompletionVal[]> {
    const params = new URLSearchParams({
      batch: "1",
      input: JSON.stringify({
        "0": {
          handle: handle === "me" ? (await this.user()).username : handle ?? "",
          name: name || null,
        },
      }),
    });
    const url = new URL(
      // TODO: temporary hack to avoid CORS
      `http://localhost:8080/https://val.town/api/trpc/autocomplete`
    );
    url.search = params.toString();
    const res = await this.fetch(
      url,
      // TODO: also remove this line once CORS is fixed
      { headers: { Authorization: `Bearer ${this.token}` } }
    );
    return ((await res.json()) as any)[0].result.data;
  }
}
