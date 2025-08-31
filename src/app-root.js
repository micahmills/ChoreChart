import { LitElement, html, css } from "lit";
import { supabase } from "./lib/supabaseClient.js";
import "./views/login-view.js";
import "./views/family-dashboard.js";

export class AppRoot extends LitElement {
  static properties = {
    route: { type: String },
    session: { state: true },
    profile: { state: true },
  };

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 100dvh;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #333;
    }
    nav a {
      margin-right: 1rem;
      text-decoration: none;
      opacity: 0.9;
    }
    main {
      padding: 1rem;
      max-width: 960px;
      margin: 0 auto;
      width: 100%;
    }
    button {
      background: #2563eb;
      border: none;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    button.secondary {
      background: #4b5563;
    }
  `;

  constructor() {
    super();
    this.route = location.hash.replace("#", "") || "login";
    this.session = null;
    this.profile = null;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("hashchange", () => {
      this.route =
        location.hash.replace("#", "") ||
        (this.session ? "dashboard" : "login");
    });
    this.initAuth();
  }

  async initAuth() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    this.session = session;
    if (session) {
      await this.loadProfile();
      this.route = this.route === "login" ? "dashboard" : this.route;
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      this.session = session;
      if (session) {
        await this.loadProfile();
        location.hash = "#dashboard";
      } else {
        this.profile = null;
        location.hash = "#login";
      }
    });
  }

  async loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("id", user.id)
      .single();
    if (error && error.code !== "PGRST116") console.error(error);
    // Ensure profile always contains the auth user id for downstream components
    this.profile = data || { id: user.id };
  }

  async signOut() {
    await supabase.auth.signOut();
  }

  renderHeader() {
    return html`
      <header>
        <strong>Chore Chart</strong>
        <nav>
          ${this.session
            ? html`
                <a href="#dashboard">Dashboard</a>
                <button class="secondary" @click=${this.signOut}>
                  Sign out
                </button>
              `
            : html`<a href="#login">Login</a>`}
        </nav>
      </header>
    `;
  }

  render() {
    return html`
      <main>
        ${this.route === "login"
          ? html` <login-view></login-view> `
          : html`
              <family-dashboard
                .session=${this.session}
                .profile=${this.profile}
                @profile-updated=${() => this.loadProfile()}
              ></family-dashboard>
            `}
      </main>
    `;
  }
}
customElements.define("app-root", AppRoot);
