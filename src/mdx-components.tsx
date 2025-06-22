import type { MDXComponents } from "mdx/types";
import { MDXWrapper } from "./components/mdx/mdx-wrapper";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    wrapper: (props) => <MDXWrapper {...props} />,
    h1: (props) => <h1 {...props} />,
    h2: (props) => <h1 {...props} />,
    h3: (props) => <h1 {...props} />,
    h4: (props) => <h1 {...props} />,
    h5: (props) => <h1 {...props} />,
    h6: (props) => <h1 {...props} />,
    ...components,
  };
}
