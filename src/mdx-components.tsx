import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props) => <h1 style={{ color: 'tomato' }} {...props} />,
    h2: (props) => <h1 style={{ color: 'blue' }} {...props} />,
    h3: (props) => <h1 style={{ color: 'green' }} {...props} />,
    h4: (props) => <h1 style={{ color: 'red' }} {...props} />,
    h5: (props) => <h1 style={{ color: 'yellow' }} {...props} />,
    h6: (props) => <h1 style={{ color: 'brown' }} {...props} />,
    ...components,
  }
}