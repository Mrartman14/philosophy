type UniqueContentRendererProps = {
  componentName: string;
};

export const UniqueContentRenderer = async ({
  componentName,
}: UniqueContentRendererProps) => {
  try {
    const asyncModule = await import(
      `@/components/unique-content/${componentName}`
    );
    const Component = asyncModule.default;
    return Component ? <Component /> : null;
  } catch (error) {
    console.error(`Error loading component ${componentName}:`, error);
    return null;
  }
};
