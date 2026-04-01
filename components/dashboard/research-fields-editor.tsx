"use client";

import type { ResearchFieldDraft } from "@/shared/types";
import { makeResearchField } from "@/shared/profile-utils";
import styles from "./research-fields-editor.module.css";

function parseList(value: string) {
  return value.split("\n");
}

function stringifyList(value: string[]) {
  return value.join("\n");
}

type Props = {
  fields: ResearchFieldDraft[];
  onChange: (fields: ResearchFieldDraft[]) => void;
};

export function ResearchFieldsEditor({ fields, onChange }: Props) {
  function updateField(index: number, patch: Partial<ResearchFieldDraft>) {
    onChange(
      fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  function removeField(index: number) {
    const next = fields.filter((_, fieldIndex) => fieldIndex !== index);
    onChange(next.length > 0 ? next : [makeResearchField("")]);
  }

  function addField() {
    onChange([...fields, makeResearchField("")]);
  }

  return (
    <div className={styles.stack}>
      {fields.map((field, index) => (
        <div key={field.id || `field-${index}`} className={styles.fieldCard}>
          <div className={styles.row}>
            <strong>Research field {index + 1}</strong>
            <button
              type="button"
              className={styles.buttonDanger}
              onClick={() => removeField(index)}
            >
              Remove
            </button>
          </div>
          <label className={styles.label}>
            Field name
            <input
              className={styles.input}
              value={field.name}
              onChange={(event) =>
                updateField(index, { name: event.target.value })
              }
              placeholder="e.g. Computer Vision for Medical Imaging"
            />
          </label>
          <label className={styles.label}>
            Relevant highlights for this field
            <textarea
              className={styles.textarea}
              value={stringifyList(field.highlights)}
              onChange={(event) =>
                updateField(index, { highlights: parseList(event.target.value) })
              }
              placeholder="One relevant project or experience per line"
            />
          </label>
        </div>
      ))}

      <div className={styles.buttonRow}>
        <button type="button" className={styles.buttonGhost} onClick={addField}>
          Add research field
        </button>
      </div>
    </div>
  );
}
