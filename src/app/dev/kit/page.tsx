// src/app/dev/kit/page.tsx
import { notFound } from "next/navigation";

import {
  Button,
  IconButton,
  TextInput,
  Textarea,
  Form,
  FormField,
  SubmitButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  EmptyState,
  Skeleton,
  Pagination,
} from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";

export const metadata = { title: "UI Kit smoke" };

export default async function UiKitSmokePage() {
  // Dev-only витрина UI-кита — в проде маршрут недоступен.
  if (process.env.NODE_ENV === "production") notFound();

  const paginationLabels = await getPaginationLabels();
  return (
    <div className="flex flex-col gap-8 p-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <IconButton aria-label="Close">×</IconButton>
        </div>
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">Form</h2>
        <Form>
          <FormField name="title" label="Заголовок" required>
            <TextInput name="title" />
          </FormField>
          <FormField
            name="description"
            label="Описание"
            description="Не более 500 символов"
          >
            <Textarea name="description" />
          </FormField>
          <SubmitButton>Сохранить</SubmitButton>
        </Form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Table</h2>
        <Table>
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Имя</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>1</Td>
              <Td>Alpha</Td>
            </Tr>
          </Tbody>
        </Table>
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">EmptyState</h2>
        <EmptyState title="Пусто" description="Здесь пока ничего нет." />
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">Skeleton</h2>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </section>

      <section className="flex flex-col gap-2 max-w-md">
        <h2 className="text-lg font-bold">Form (invalid state)</h2>
        <Form errors={{ email: "Неверный формат email" }}>
          <FormField name="email" label="Email" required>
            <TextInput name="email" />
          </FormField>
          <SubmitButton>Отправить</SubmitButton>
        </Form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Pagination</h2>
        <Pagination basePath="/dev/kit" offset={20} limit={20} total={100} labels={paginationLabels} />
      </section>
    </div>
  );
}
