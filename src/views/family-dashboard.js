import { LitElement, html, css } from "lit";
import { supabase } from "../lib/supabaseClient.js";
import "../components/chore-assignment.js";
import "../components/chore-list.js";
import "../components/approvals-list.js";
import "../components/streak-tracker.js";

export class FamilyDashboard extends LitElement {
  static properties = {
    session: { type: Object },
    profile: { type: Object },
    family: { state: true },
    /** @type {{id: string, name: string, role: string}[]} */
    members: { state: true },
  };

  static styles = css`
    :host {
      display: grid;
      gap: 1rem;
    }
    .grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: 1fr;
    }
    @media (min-width: 900px) {
      .grid {
        grid-template-columns: 1fr 1fr;
      }
    }
    section {
      border: 1px solid #333;
      border-radius: 0.5rem;
      padding: 1rem;
    }
    h3 {
      margin: 0 0 0.5rem;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    li {
      padding: 0.25rem 0;
    }
    input {
      padding: 0.5rem;
      border-radius: 0.375rem;
      border: 1px solid #444;
      background: transparent;
      color: inherit;
    }
    button {
      background: #2563eb;
      border: none;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      cursor: pointer;
    }
  `;

  constructor() {
    super();
    this.family = null;
    this.members = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this.refresh();
  }

  // Re-run refresh when session becomes available from parent
  updated(changedProps) {
    if (changedProps.has("session") && this.session) {
      this.refresh();
    }
  }

  async refresh() {
    console.log("Refreshing family dashboard");
    console.log(this.session);
    if (!this.session) return;
    await this.ensureProfileRow();
    await this.loadFamily();
    await this.loadMembers();
  }

  async ensureProfileRow() {
    console.log("Ensuring profile row exists");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) console.error(error);
    if (!data) {
      // Create a default user profile with no family yet
      const name = user.email?.split("@")[0] || "User";
      await supabase
        .from("users")
        .insert({ id: user.id, name, role: "parent" });
      this.dispatchEvent(
        new CustomEvent("profile-updated", { bubbles: true, composed: true })
      );
    }
  }

  async createFamily(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = new FormData(form).get("name");

    const { data: fam, error } = await supabase
      .from("families")
      .insert({ name })
      .select("*")
      .single();
    if (error) return console.log(error), alert(error.message);
    // Link current user to family as parent
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log(user);
    await supabase
      .from("users")
      .update({ family_id: fam.id, role: "parent" })
      .eq("id", user.id);
    await this.refresh();
  }

  async loadFamily() {
    console.log("Loading family");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log(user);
    if (!user) return;
    const { data: me } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();
    if (me?.family_id) {
      const { data: fam } = await supabase
        .from("families")
        .select("*")
        .eq("id", me.family_id)
        .single();
      this.family = fam;
    } else {
      this.family = null;
    }
  }

  async loadMembers() {
    if (!this.family) {
      this.members = [];
      return;
    }
    const { data, error } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("family_id", this.family.id)
      .order("name");
    if (!error) this.members = data;
  }

  get isParent() {
    return this.profile?.role === "parent";
  }

  renderNoFamily() {
    return html`
      <section>
        <h3>Create your family</h3>
        <form @submit=${this.createFamily}>
          <input required name="name" placeholder="Family name" />
          <button type="submit">Create</button>
        </form>
        <p>
          You can invite your family by having them sign in and linking them to
          your family id.
        </p>
      </section>
    `;
  }

  renderFamily() {
    return html`
      <section>
        <h3>Family: ${this.family?.name}</h3>
        <p>Members:</p>
        <ul>
          ${this.members.map((m) => html`<li>${m.name} — ${m.role}</li>`)}
        </ul>
      </section>
      <div class="grid">
        <section>
          <h3>Your Chores</h3>
          <chore-list
            .familyId=${this.family.id}
            .currentUserId=${this.profile?.id}
            .isParent=${this.isParent}
          ></chore-list>
        </section>
        <section>
          <h3>Streaks</h3>
          <streak-tracker .familyId=${this.family.id}></streak-tracker>
        </section>
        ${this.isParent
          ? html`
              <section>
                <h3>Assign Chores</h3>
                <chore-assignment
                  .familyId=${this.family.id}
                  .members=${this.members}
                ></chore-assignment>
              </section>
              <section>
                <h3>Approvals</h3>
                <approvals-list
                  .familyId=${this.family.id}
                  .parentId=${this.profile?.id}
                ></approvals-list>
              </section>
            `
          : ""}
      </div>
    `;
  }

  render() {
    console.log("Rendering family dashboard");
    console.log(this.family);
    // If no session yet, avoid showing the create-family UI prematurely
    if (!this.session) return html`<p>Loading...</p>`;
    if (!this.family) return this.renderNoFamily();
    return this.renderFamily();
  }
}
customElements.define("family-dashboard", FamilyDashboard);
