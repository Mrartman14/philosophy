// src/features/forms/permissions.test.ts
import { describe, expect, it } from "vitest";

import type { Me } from "@/utils/me";

import {
  canCreateForm,
  canEditForm,
  canPublishForm,
  canDeleteForm,
  canListFormSubmissions,
  canEditSubmission,
  canDeleteSubmission,
  canRetractSubmission,
  canAdminDeleteForm,
  canListAdminForms,
  canViewFormResults,
} from "./permissions";
import type { Form, Submission } from "./types";

function makeMe(over: Partial<Me> = {}): Me {
  return {
    id: "u1",
    username: "alice",
    role: "user",
    status: "active",
    capabilities: [],
    ...over,
  };
}

const draftPrivate: Form = {
  id: "f1",
  owner: { id: "u1" },
  visibility: "private",
  submission_mode: "editable",
};
const publishedPublic: Form = {
  id: "f2",
  owner: { id: "u1" },
  visibility: "public",
  submission_mode: "editable",
  published_at: "2026-06-01T00:00:00Z",
};
const othersPublic: Form = {
  id: "f3",
  owner: { id: "u9" },
  visibility: "public",
  submission_mode: "immutable",
  published_at: "2026-06-01T00:00:00Z",
};
const immutableOwned: Form = {
  id: "f4",
  owner: { id: "u1" },
  visibility: "public",
  submission_mode: "immutable",
  published_at: "2026-06-01T00:00:00Z",
};

const activeSub: Submission = { id: "s1", form_id: "f1", user: { id: "u1" } };
const retractedSub: Submission = {
  id: "s2",
  form_id: "f4",
  user: { id: "u1" },
  retracted_at: "2026-06-02T00:00:00Z",
};

describe("canCreateForm", () => {
  it("гость → false", () => { expect(canCreateForm(null)).toBe(false); });
  it("active с form.create → true", () =>
    { expect(canCreateForm(makeMe({ capabilities: ["form.create"] }))).toBe(true); });
  it("active без капы → false", () => { expect(canCreateForm(makeMe())).toBe(false); });
  it("suspended с капой → false", () =>
    { expect(canCreateForm(makeMe({ status: "suspended", capabilities: ["form.create"] }))).toBe(
      false,
    ); });
});

describe("canEditForm (owner-only, не опубликована)", () => {
  it("владелец draft → true", () => { expect(canEditForm(makeMe(), draftPrivate)).toBe(true); });
  it("владелец опубликованной → false (заморожена)", () =>
    { expect(canEditForm(makeMe(), publishedPublic)).toBe(false); });
  it("не владелец → false", () =>
    { expect(
      canEditForm(makeMe({ id: "x", role: "admin", capabilities: ["form.delete_any"] }), draftPrivate),
    ).toBe(false); });
  it("suspended владелец → false", () =>
    { expect(canEditForm(makeMe({ status: "suspended" }), draftPrivate)).toBe(false); });
});

describe("canPublishForm", () => {
  it("владелец private draft → true", () =>
    { expect(canPublishForm(makeMe(), draftPrivate)).toBe(true); });
  it("уже public → false", () => { expect(canPublishForm(makeMe(), publishedPublic)).toBe(false); });
  it("не владелец → false", () =>
    { expect(canPublishForm(makeMe({ id: "x" }), draftPrivate)).toBe(false); });
});

describe("canDeleteForm", () => {
  it("владелец draft → true", () => { expect(canDeleteForm(makeMe(), draftPrivate)).toBe(true); });
  it("admin delete_any на чужой public → true", () =>
    { expect(
      canDeleteForm(makeMe({ id: "adm", role: "admin", capabilities: ["form.delete_any"] }), othersPublic),
    ).toBe(true); });
  it("admin delete_any на чужой private → false (бек 404)", () => {
    const othersPrivate: Form = { id: "f5", owner: { id: "u9" }, visibility: "private", submission_mode: "editable" };
    expect(
      canDeleteForm(makeMe({ id: "adm", role: "admin", capabilities: ["form.delete_any"] }), othersPrivate),
    ).toBe(false);
  });
  it("чужой без капы → false", () =>
    { expect(canDeleteForm(makeMe({ id: "x" }), othersPublic)).toBe(false); });
});

describe("canListFormSubmissions (только владелец)", () => {
  it("владелец → true", () => { expect(canListFormSubmissions(makeMe(), draftPrivate)).toBe(true); });
  it("не владелец (даже admin) → false", () =>
    { expect(
      canListFormSubmissions(makeMe({ id: "adm", role: "admin", capabilities: ["form.delete_any"] }), othersPublic),
    ).toBe(false); });
});

describe("canEditSubmission / canDeleteSubmission (editable, автор)", () => {
  it("автор editable active → edit true, delete true", () => {
    expect(canEditSubmission(makeMe(), draftPrivate, activeSub)).toBe(true);
    expect(canDeleteSubmission(makeMe(), draftPrivate, activeSub)).toBe(true);
  });
  it("immutable форма → edit/delete false", () => {
    const sub: Submission = { id: "s9", form_id: "f4", user: { id: "u1" } };
    expect(canEditSubmission(makeMe(), immutableOwned, sub)).toBe(false);
    expect(canDeleteSubmission(makeMe(), immutableOwned, sub)).toBe(false);
  });
  it("не автор → false", () => {
    expect(canEditSubmission(makeMe({ id: "x" }), draftPrivate, activeSub)).toBe(false);
  });
  it("retracted → edit false", () => {
    expect(canEditSubmission(makeMe(), draftPrivate, { ...activeSub, retracted_at: "2026-06-02T00:00:00Z" })).toBe(false);
  });
});

describe("canRetractSubmission (immutable, автор, не retracted)", () => {
  it("автор immutable active → true", () => {
    const sub: Submission = { id: "s9", form_id: "f4", user: { id: "u1" } };
    expect(canRetractSubmission(makeMe(), immutableOwned, sub)).toBe(true);
  });
  it("editable форма → false (RETRACT_NOT_APPLICABLE)", () =>
    { expect(canRetractSubmission(makeMe(), draftPrivate, activeSub)).toBe(false); });
  it("уже retracted → false", () =>
    { expect(canRetractSubmission(makeMe(), immutableOwned, retractedSub)).toBe(false); });
  it("не автор → false", () =>
    { expect(canRetractSubmission(makeMe({ id: "x" }), immutableOwned, { id: "s9", form_id: "f4", user: { id: "u1" } })).toBe(
      false,
    ); });
});

describe("canAdminDeleteForm / canListAdminForms", () => {
  it("delete_any на public → true", () =>
    { expect(canAdminDeleteForm(makeMe({ capabilities: ["form.delete_any"] }), othersPublic)).toBe(true); });
  it("delete_any на private → false", () => {
    const priv: Form = { id: "f7", owner: { id: "u9" }, visibility: "private", submission_mode: "editable" };
    expect(canAdminDeleteForm(makeMe({ capabilities: ["form.delete_any"] }), priv)).toBe(false);
  });
  it("без капы → list false", () => { expect(canListAdminForms(makeMe())).toBe(false); });
  it("с капой → list true", () =>
    { expect(canListAdminForms(makeMe({ capabilities: ["form.delete_any"] }))).toBe(true); });
});

describe("canViewFormResults (чтение: владелец ∨ public, без status-гейта)", () => {
  const ownerPrivate: Form = {
    id: "fr1",
    owner: { id: "u1" },
    visibility: "public",
    submission_mode: "editable",
    submission_visibility: "private",
  };
  const othersPublicResults: Form = {
    id: "fr2",
    owner: { id: "u9" },
    visibility: "public",
    submission_mode: "editable",
    submission_visibility: "public",
  };
  const othersPrivateResults: Form = {
    id: "fr3",
    owner: { id: "u9" },
    visibility: "public",
    submission_mode: "editable",
    submission_visibility: "private",
  };

  it("владелец видит результаты приватной формы", () => {
    expect(canViewFormResults(makeMe(), ownerPrivate)).toBe(true);
  });
  it("suspended-владелец всё ещё видит (чтение, без status-гейта)", () => {
    expect(canViewFormResults(makeMe({ status: "suspended" }), ownerPrivate)).toBe(true);
  });
  it("не-владелец видит публичные результаты", () => {
    expect(canViewFormResults(makeMe(), othersPublicResults)).toBe(true);
  });
  it("не-владелец НЕ видит приватные результаты", () => {
    expect(canViewFormResults(makeMe(), othersPrivateResults)).toBe(false);
  });
  it("аноним (me=null) → false", () => {
    expect(canViewFormResults(null, othersPublicResults)).toBe(false);
  });
});

describe("canDeleteSubmission (доп. ветки доступа)", () => {
  it("гость → false", () =>
    { expect(canDeleteSubmission(null, draftPrivate, activeSub)).toBe(false); });
  it("не автор → false", () =>
    { expect(canDeleteSubmission(makeMe({ id: "x" }), draftPrivate, activeSub)).toBe(false); });
  it("suspended автор → false", () =>
    { expect(canDeleteSubmission(makeMe({ status: "suspended" }), draftPrivate, activeSub)).toBe(false); });
});
