import { createRootRoute, Outlet } from "@tanstack/react-router"

import NotFound from "@/components/Common/NotFound"
import Header from "@/components/Common/Header"

export const Route = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
      {/* <Suspense>
        <TanStackDevtools />
      </Suspense> */}
    </>
  ),
  notFoundComponent: () => <NotFound />,
})
