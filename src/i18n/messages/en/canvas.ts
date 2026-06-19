// src/i18n/messages/en/canvas.ts
// Mirror of ru/canvas.ts (English literals). Key parity enforced by satisfies Messages.
import type { Messages } from "../ru";

const canvas: Messages["canvas"] = {
  // --- canvas-create-form ---
  createForm: {
    titleLabel: "Title",
    visibilityLabel: "Visibility",
    dataLabel: "Graph data (JSON, optional)",
    dataDescription: 'Example: {"nodes":[],"edges":[]}',
    visibilityPrivate: "Private",
    visibilityPublic: "Public",
    submitCreate: "Create",
    toastCreatedTitle: "Canvas created",
    toastErrorTitle: "Error",
  },

  // --- canvas-edit-form ---
  editForm: {
    titleLabel: "Title",
    dataLabel: "Graph data (JSON)",
    submitSave: "Save",
    toastSavedTitle: "Saved",
    toastErrorTitle: "Error",
    forbiddenUpdate: "editing the canvas",
  },

  // --- canvas-delete-button ---
  deleteButton: {
    trigger: "Delete",
    title: "Delete canvas?",
    description: "This action is irreversible.",
    confirmLabel: "Delete",
    toastDeletedTitle: "Canvas deleted",
    forbiddenDelete: "deleting the canvas",
  },

  // --- canvas-visibility-button ---
  visibilityButton: {
    makePublic: "Make public",
    toastPublishedTitle: "Canvas published",
    toastErrorTitle: "Error",
    forbiddenVisibility: "changing canvas visibility",
  },

  // --- canvas-editor ---
  editor: {
    ariaLabel: "Canvas editor",
    toastValidationTitle: "Graph validation failed",
    toastValidationFallback: "Fix the errors.",
    toastSavedTitle: "Saved",
    toastSaveErrorTitle: "Save error",
    forbiddenUpdate: "editing the canvas",
    confirmLeave: "There are unsaved changes. Leave without saving?",
  },

  // --- editor-toolbar ---
  toolbar: {
    back: "← Back",
    addText: "Text",
    addRect: "Rect.",
    addEllipse: "Ellipse",
    addDiamond: "Diamond",
    addLink: "Link",
    deleteSelected: "Delete",
    undoAriaLabel: "Undo",
    redoAriaLabel: "Redo",
    grid: "Grid",
    showCanvas: "Canvas",
    showJson: "JSON",
    unsavedChanges: "Unsaved changes",
    saving: "Saving…",
    save: "Save",
  },

  // --- editor-inspector ---
  inspector: {
    emptyHint: "Select a node or edge.",
    nodeHeading: "Node: {type}",
    shapeLabel: "Shape",
    shapeAriaLabel: "Shape",
    shapeRect: "Rectangle",
    shapeEllipse: "Ellipse",
    shapeDiamond: "Diamond",
    widthLabel: "Width",
    heightLabel: "Height",
    edgeHeading: "Edge",
    edgeCaptionLabel: "Label",
    edgeStyleLabel: "Style",
    edgeStyleAriaLabel: "Style",
    edgeStyleSolid: "Solid",
    edgeStyleDashed: "Dashed",
    edgeEndLabel: "End",
    edgeEndAriaLabel: "End",
    edgeEndArrow: "Arrow",
    edgeEndNone: "No arrow",
    edgeFromSideLabel: "From side",
    edgeFromSideAriaLabel: "From side",
    edgeToSideLabel: "To side",
    edgeToSideAriaLabel: "To side",
    sideAuto: "auto",
    sideTop: "top",
    sideRight: "right",
    sideBottom: "bottom",
    sideLeft: "left",
  },

  // --- entity-ref-dialog ---
  entityRefDialog: {
    title: "Add entity reference",
    typeLabel: "Entity type",
    typeAriaLabel: "Entity type",
    idLabel: "Entity ID (UUID)",
    addButton: "Add",
    typeDocument: "Document",
    typeLecture: "Lecture",
    typeGlossary: "Glossary",
    typeMedia: "Media",
    typeCanvas: "Canvas",
    typeComment: "Comment",
    typeAnnotation: "Annotation",
    typeForm: "Form",
    typeBanner: "Banner",
    typeEvent: "Event",
  },

  // --- canvas-my-list ---
  myList: {
    empty: "No canvases yet.",
    untitled: "Untitled",
    visibilityPublic: "public",
    visibilityPrivate: "private",
  },

  // --- canvas-containers ---
  containers: {
    title: "Included in lectures",
    emptyText: "Canvas is not included in any lecture.",
    lectureLabel: "Lecture {id}",
  },

  // --- canvas-revisions ---
  revisions: {
    versionLabel: "Version {num}",
  },

  // --- canvas-search ---
  search: {
    placeholder: "Search by title",
    submit: "Find",
  },

  // --- forbidden actions ---
  forbiddenCreateAction: "creating a canvas",

  // --- api.ts: fetch error messages (thrown to React error boundary) ---
  api: {
    loadCanvasesFailed: "Failed to load canvases",
    loadCanvasFailed: "Failed to load canvas",
    loadRevisionsFailed: "Failed to load revisions",
    loadRevisionFailed: "Failed to load revision",
    loadContainersFailed: "Failed to load attachments",
  },
};

export default canvas;
