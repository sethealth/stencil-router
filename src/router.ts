import { FunctionalComponent, Build } from '@stencil/core';
import { createStore } from '@stencil/store';
import type {
  Router,
  RouterOptions,
  InternalRouterState,
  RouteEntry,
  RouteProps,
  RoutePath,
} from './types';

let defaultRouter: Router | undefined;

export const createRouter = (opts?: RouterOptions): Router => {
  const win = window;
  const url = new URL(win.location.href);
  const parseURL = opts?.parseURL ?? DEFAULT_PARSE_URL;
  const { state, onChange, dispose } = createStore<InternalRouterState>(
    {
      url,
      activePath: parseURL(url),
    },
    (newV, oldV, prop) => {
      if (prop === 'url') {
        return newV.href !== oldV.href;
      }
      return newV !== oldV;
    }
  );

  const push = (href: string, options?: { replace: boolean }) => {
    if (options?.replace) {
      history.replaceState(null, null as any, href);
    } else {
      history.pushState(null, null as any, href);
    }
    const url = new URL(href, document.baseURI);
    state.url = url;
    state.activePath = parseURL(url);
  };

  const match = (routes: RouteEntry[]) => {
    const { activePath } = state;
    for (let route of routes) {
      const params = matchPath(activePath, route.path);
      if (params) {
        if (route.to != null) {
          const to = typeof route.to === 'string' ? route.to : route.to(activePath);
          push(to, { replace: true });
          return match(routes);
        } else {
          return { params, route };
        }
      }
    }
    return undefined;
  };

  const navigationChanged = () => {
    const url = new URL(win.location.href);
    state.url = url;
    state.activePath = parseURL(url);
  };

  const Switch: any = (_: any, childrenRoutes: RouteEntry[]) => {
    const result = match(childrenRoutes);
    if (result) {
      if (typeof result.route.jsx === 'function') {
        return result.route.jsx(result.params);
      } else {
        return result.route.jsx;
      }
    }
  };

  const disposeRouter = () => {
    defaultRouter = undefined;
    win.removeEventListener('popstate', navigationChanged);
    dispose();
  };

  const router = (defaultRouter = {
    Switch,
    get url() {
      return state.url;
    },
    get activePath() {
      return state.activePath;
    },
    push,
    onChange: onChange as any,
    dispose: disposeRouter,
  });

  // Initial update
  navigationChanged();

  // Listen URL changes
  win.addEventListener('popstate', navigationChanged);

  return router;
};

export const Route: FunctionalComponent<RouteProps> = (props, children) => {
  if ('to' in props) {
    return {
      path: props.path,
      to: props.to,
    } as any;
  }
  if (Build.isDev && props.render && children.length > 0) {
    console.warn('Route: if `render` is provided, the component should not have any children');
  }
  return {
    path: props.path,
    id: props.id,
    jsx: props.render ?? children,
  } as any;
};

interface HrefOptions {
  router?: Router;
  onClick?: (ev: MouseEvent) => void | boolean;
}

export const href = (
  href: string,
  opts?: HrefOptions | Router | ((ev: MouseEvent) => void | boolean)
) => {
  let router: Router;
  let onClick: ((ev: MouseEvent) => void | boolean) | undefined;
  if (typeof opts === 'object' && !('Switch' in opts)) {
    router = opts.router;
    onClick = opts.onClick;
  } else if (typeof opts === 'object') {
    router = opts;
  } else {
    onClick = opts;
  }
  router = router ?? defaultRouter;
  if (Build.isDev && !router) {
    throw new Error('Router must be defined in href');
  }
  return {
    href,
    onClick: (ev: MouseEvent) => {
      if (ev.metaKey || ev.ctrlKey) {
        return;
      }

      if (ev.which == 2 || ev.button == 1) {
        return;
      }

      ev.preventDefault();
      if (onClick) {
        if (onClick(ev) === false) {
          return;
        }
      }
      router.push(href);
    },
  };
};

const matchPath = (pathname: string, path: RoutePath): { [params: string]: any } => {
  if (typeof path === 'string') {
    if (path === pathname) {
      return {};
    }
  } else if (typeof path === 'function') {
    const params = path(pathname);
    if (params) {
      return params === true ? {} : { ...params };
    }
  } else {
    const results = path.exec(pathname);
    if (results) {
      path.lastIndex = 0;
      return { ...results };
    }
  }
  return undefined;
};

const DEFAULT_PARSE_URL = (url: URL) => {
  return url.pathname.toLowerCase();
};

export const NotFound = () => ({});
