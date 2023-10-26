export type BaseVal = {
  id: string
  name: string,
  code: string,
  privacy: "public" | "private" | "unlisted"
  version: number,
  runStartAt: string,
  runEndAt: string,
  author: {
    id: string;
    username: string;
  }
}

export type FullVal = BaseVal & {
  readme: string,
}

type Paginated<T> = {
  data: T[],
  links: {
    self: string,
    next?: string,
    prev?: string,
  }
}

export type Version = {
  valID: string,
  version: number,
  runStartAt: string,
  runEndAt: string,
}

const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

export class ValtownClient {
  private _uid: string | undefined;

  constructor(public endpoint: string, private token?: string) { }

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
    }
    return fetch(url, {
      ...init,
      headers
    })
  }

  async uid() {
    if (!this._uid) {
      const resp = await this.fetch(`${this.endpoint}/v1/me`)
      if (resp.status !== 200) {
        throw new Error("Failed to get user ID");
      }

      const body = await resp.json() as { id: string }

      this._uid = body.id;
    }

    return this._uid;
  }

  async createVal() {
    const suffix = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

    const code = `export async function untitled_${suffix}() {

};`
    const resp = await this.fetch(`${this.endpoint}/v1/vals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    })
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

      const body = await resp.json() as Paginated<BaseVal>;
      vals.push(...body.data);
      if (!body.links.next) {
        break
      }

      endpoint = body.links.next.replace("http://", "https://")
    }

    return vals
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
      const body = await resp.json() as Paginated<BaseVal>;
      vals.push(...body.data);

      if (!body.links.next) {
        break;
      }

      endpoint = body.links.next.replace("http://", "https://")
    }

    return vals
  }

  async listVersions(valId: string) {
    let endpoint = `${this.endpoint}/v1/vals/${valId}/versions?limit=100`;
    const versions = [] as Version[];
    while (true) {
      const resp = await this.fetch(endpoint);
      if (!resp.ok) {
        throw new Error("Failed to get versions");
      }

      const body = await resp.json() as Paginated<Version>;
      versions.push(...body.data);

      if (!body.links.next) {
        break;
      }

      endpoint = body.links.next.replace("http://", "https://")
    }

    return versions;
  }

  async getVal(valId: string, version?: number) {
    const endpoint = version ? `${this.endpoint}/v1/vals/${valId}/versions/${version}` : `${this.endpoint}/v1/vals/${valId}`;
    const resp = await this.fetch(endpoint);

    if (!resp.ok) {
      throw new Error("Failed to get val");
    }

    return resp.json() as Promise<FullVal>;
  }

  async writeVal(
    valID: string,
    code: string,
  ) {
    console.log("writing val", valID, code)
    const resp = await this.fetch(`${this.endpoint}/v1/vals/${valID}/versions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
      }),
    });

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
    const resp = await this.fetch(`${this.endpoint}/v1/alias/${username}/${valname}`);

    if (!resp.ok) {
      throw new Error("Failed to resolve val");
    }

    return resp.json();
  }
}
