"use client";

import { useEffect, useState } from "react";

import { ExamConfig } from "@/utils/exams-config";
import { Radio } from "@base-ui-components/react/radio";
import { RadioGroup } from "@base-ui-components/react/radio-group";

type ExamRule = {
  title: string;
  order: number;
  sources: string[];
  answer: string;
  isSuggestionCorrect?: boolean;
};

interface ExamViewerProps {
  config: ExamConfig;
  className: string;
}
export const ExamViewer: React.FC<ExamViewerProps> = ({
  config,
  className,
}) => {
  const [data, setData] = useState<ExamRule[]>([]);

  useEffect(() => {
    async function getJSON() {
      const res = await fetch(config.sources[0].path);
      const nextJson = await res.json();
      setData(nextJson);
    }

    getJSON();
  }, [config.sources]);

  const handleVote = (order: number) => (b: boolean) =>
    setData((prev) =>
      prev.map((x) => {
        if (x.order === order) {
          return { ...x, isSuggestionCorrect: b };
        } else {
          return x;
        }
      })
    );

  const voted = data.filter((x) => typeof x.isSuggestionCorrect === "boolean");
  const correctVoted = voted.filter((x) => x.isSuggestionCorrect);
  return (
    <div className={`prose dark:prose-invert lg:prose-xl px-4 ${className}`}>
      {data.map((rule) => (
        <RuleView
          key={rule.order}
          rule={rule}
          onVote={handleVote(rule.order)}
        />
      ))}
      {voted.length === data.length && (
        <>
          <p className="text-3xl" style={{ textAlign: "right" }}>
            Итоговый результат: {correctVoted.length} / {data.length}
          </p>
          <p className="pb-2">
            Ваши интерпретации картинок могут оказаться столь же правильными,
            что и закладываемые авторами.
          </p>
        </>
      )}
    </div>
  );
};

const RuleView: React.FC<{ rule: ExamRule; onVote: (b: boolean) => void }> = ({
  rule,
  onVote,
}) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  return (
    <div>
      <h3>
        {rule.order}. {rule.title}
      </h3>
      <div>
        <div
          className={`grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,_minmax(400px,_1fr))]`}
        >
          {rule.sources.map((source) => (
            <img
              alt="Task image"
              key={source}
              src={`${basePath}${source}`}
              style={{ margin: 0 }}
            />
          ))}
        </div>

        <p>
          <span className="font-semibold text-(--description)">Ответ: </span>
          <span
            role="switch"
            aria-checked={isAnswerRevealed}
            onClick={() => setIsAnswerRevealed((prev) => !prev)}
            className={`spoiler ${isAnswerRevealed ? "revealed" : ""}`}
          >
            {isAnswerRevealed
              ? rule.answer
              : rule.answer.replace(/[^\s]/g, "?")}
          </span>
        </p>

        <RadioGroup
          onValueChange={(x) => onVote(x as boolean)}
          aria-labelledby={`${rule.title}`}
          className={`flex flex-col items-start gap-1 ${
            isAnswerRevealed ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="font-semibold text-(--description)"
            id={`${rule.title}`}
          >
            Совпал ли ваш ответ
          </div>

          {[
            { name: "Да", value: true },
            { name: "Нет", value: false },
          ].map((opt) => (
            <label key={opt.name} className="flex items-center gap-2">
              <Radio.Root
                value={opt.value}
                className="flex size-5 items-center justify-center rounded-full data-[checked]:bg-(--border) data-[unchecked]:border data-[unchecked]:border-(--border)"
              >
                <Radio.Indicator className="flex before:size-2 before:rounded-full before:bg-(--primary) data-[unchecked]:hidden" />
              </Radio.Root>
              {opt.name}
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
};
