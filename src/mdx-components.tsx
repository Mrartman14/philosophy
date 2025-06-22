import type { MDXComponents } from "mdx/types";

import { MDXWrapper } from "./components/mdx/mdx-wrapper";
import { MdxHeading } from "./components/mdx/mdx-heading";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    wrapper: (props) => <MDXWrapper {...props} />,
    h1: (props) => <MdxHeading level="h1" {...props} />,
    h2: (props) => <MdxHeading level="h2" {...props} />,
    h3: (props) => <MdxHeading level="h3" {...props} />,
    h4: (props) => <MdxHeading level="h4" {...props} />,
    h5: (props) => <MdxHeading level="h5" {...props} />,
    h6: (props) => <MdxHeading level="h6" {...props} />,
    ...components,
  };
}
