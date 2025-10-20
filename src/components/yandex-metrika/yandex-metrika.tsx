/* eslint-disable */
// @ts-nocheck
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
// import ym, { YMInitializer } from "react-yandex-metrika";

function isProd() {
  const result = window.location.hostname === "localhost";
  return result;
}

const YM_COUNTER_ID = 104376496 as const;
export const YandexMetrika: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.ym && isProd()) {
      (function (m: any, e, t, r, i, k, a) {
        m[i] =
          m[i] ||
          function () {
            (m[i].a = m[i].a || []).push(arguments);
          };
        m[i].l = 1 * (new Date() as any);
        (k = e.createElement(t)),
          (a = e.getElementsByTagName(t)[0]),
          (k.async = 1),
          (k.src = r),
          a.parentNode.insertBefore(k, a);
      })(
        window,
        document,
        "script",
        "https://mc.yandex.ru/metrika/tag.js",
        "ym"
      );
      window.ym(YM_COUNTER_ID, "init", {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
    }
  }, []);

  useEffect(() => {
    if (window.ym && pathname && isProd()) {
      window.ym(YM_COUNTER_ID, "hit", pathname);
    }
  }, [pathname]);

  return null;

  // useEffect(() => {
  //   if (pathname) {
  //     ym(YM_COUNTER_ID, "hit", pathname);
  //   }
  // }, [pathname]);

  // return (
  //   <YMInitializer
  //     accounts={[YM_COUNTER_ID]}
  //     options={{
  //       defer: true,
  //       webvisor: true,
  //       clickmap: true,
  //       trackLinks: true,
  //       accurateTrackBounce: true,
  //     }}
  //     version="2"
  //   />
  // );
};
