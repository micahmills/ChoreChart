import { LitElement, html, css } from "lit";
import { supabase } from "../lib/supabaseClient.js";

/**
 * @typedef {{ id: string, name: string, role: string }} Member
 */

export class ChoreAssignment extends LitElement {
  static properties = {
    familyId: { type: String },
    /** @type {Member[]} */
    members: { type: Array },
    message: { state: true },
  };

  static styles = css`
    form {
      display: grid;
      gap: 0.5rem;
    }
    input,
    select {
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
    this.familyId = null;
    /** @type {Member[]} */
    this.members = [];
    this.message = "";
  }

  async submit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = {
      family_id: this.familyId,
      title: fd.get("title"),
      type: fd.get("type"),
      due_date: fd.get("due_date"),
      assigned_to: fd.get("assigned_to"),
      status: "pending",
    };
    const { error } = await supabase.from("chores").insert(row);
    this.message = error ? error.message : "Chore created";
    e.currentTarget.reset();
  }

  render() {
    return html`
      <form @submit=${this.submit}>
        <input required name="title" placeholder="Chore title" />
        <div style="display:flex; gap:.5rem;">
          <select name="type" required>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="one-off">One-off</option>
          </select>
          <input type="date" name="due_date" required />
          <select name="assigned_to" required>
            ${this.members.map(
              (m) => html`<option value="${m.id}">${m.name}</option>`
            )}
          </select>
        </div>
        <button type="submit">Create Chore</button>
      </form>
      ${this.message ? html`<small>${this.message}</small>` : ""}
    `;
  }
}
customElements.define("chore-assignment", ChoreAssignment);
