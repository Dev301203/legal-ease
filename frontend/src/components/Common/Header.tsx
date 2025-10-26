import { useLocation, useNavigate } from "@tanstack/react-router"
import { Box, Container, HStack, Image } from "@chakra-ui/react"
import { Breadcrumb } from "@chakra-ui/react"
import { Fragment, useEffect, useState } from "react"
import { getCaseWithSimulations, getSimulation } from "@/services/scenarioService"

interface BreadcrumbItem {
  label: string
  path?: string
  search?: Record<string, unknown>
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const [caseTitle, setCaseTitle] = useState<string>("")
  const [simulationTitle, setSimulationTitle] = useState<string>("")

  // Fetch case data when on case or scenario page
  useEffect(() => {
    const pathname = location.pathname
    const search = location.search as { id?: string; caseId?: number; simulationId?: number }

    let caseId: number | undefined

    if (pathname === "/case") {
      caseId = search.id ? Number(search.id) : undefined
    } else if (pathname === "/scenario") {
      caseId = search.caseId
    }

    if (caseId) {
      getCaseWithSimulations(caseId)
        .then((data) => {
          setCaseTitle(data.name || "")
        })
        .catch((err) => {
          console.error("Error fetching case:", err)
          setCaseTitle("")
        })
    } else {
      setCaseTitle("")
    }
  }, [location.pathname, location.search])

  // Fetch simulation data when on scenario page
  useEffect(() => {
    const pathname = location.pathname
    const search = location.search as { simulationId?: number }

    if (pathname === "/scenario" && search.simulationId) {
      getSimulation(search.simulationId)
        .then((data) => {
          setSimulationTitle(data.headline || "")
        })
        .catch((err) => {
          console.error("Error fetching simulation:", err)
          setSimulationTitle("")
        })
    } else {
      setSimulationTitle("")
    }
  }, [location.pathname, location.search])

  // Build breadcrumb items based on current route
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = []
    const pathname = location.pathname

    // Always add home as the first item (but only show it if we're not on home page)
    if (pathname !== "/") {
      items.push({ label: "Home", path: "/" })
    }

    // Add Cases if we're on cases, case, or scenario pages
    if (pathname === "/cases" || pathname === "/case" || pathname === "/scenario") {
      items.push({ label: "Cases", path: "/cases" })
    }

    // Add Case if we're on case or scenario page
    if (pathname === "/case" || pathname === "/scenario") {
      const search = location.search as { id?: string; caseId?: number; simulationId?: number }
      let caseId: string | undefined

      if (pathname === "/scenario") {
        // For scenario route, caseId is provided directly in search params
        caseId = search.caseId ? String(search.caseId) : undefined
      } else {
        // For case route, use the id parameter
        caseId = search.id
      }

      items.push({
        label: caseTitle || "Case",
        path: "/case",
        search: caseId ? { id: caseId } : undefined,
      })
    }

    // Add Scenario if we're on scenario page
    if (pathname === "/scenario") {
      items.push({ label: simulationTitle || "Scenario" })
    }

    return items
  }

  const breadcrumbItems = getBreadcrumbItems()

  // Don't show header on home page
  if (location.pathname === "/") {
    return null
  }

  // Don't show if there are no breadcrumb items
  if (breadcrumbItems.length === 0) {
    return null
  }

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    if (item.path) {
      navigate({ to: item.path, search: item.search })
    }
  }

  return (
    <Box bg="white" borderBottom="1px solid" borderColor="gray.200" py={3}>
      <Container maxW="1200px">
        <HStack gap={4} alignItems="center">
          <Image
            src="/assets/images/logo.png"
            alt="LegalEase Logo"
            height="32px"
            width="auto"
            cursor="pointer"
            onClick={() => navigate({ to: "/" })}
            _hover={{ opacity: 0.8 }}
            transition="opacity 0.2s"
          />
          <Breadcrumb.Root>
            <Breadcrumb.List>
              {breadcrumbItems.map((item, index) => {
                const isLast = index === breadcrumbItems.length - 1
                return (
                  <Fragment key={index}>
                    <Breadcrumb.Item>
                      {isLast ? (
                        <Breadcrumb.CurrentLink>{item.label}</Breadcrumb.CurrentLink>
                      ) : (
                        <Breadcrumb.Link
                          onClick={() => handleBreadcrumbClick(item)}
                          cursor="pointer"
                          _hover={{ textDecoration: "underline" }}
                        >
                          {item.label}
                        </Breadcrumb.Link>
                      )}
                    </Breadcrumb.Item>
                    {!isLast && <Breadcrumb.Separator>/</Breadcrumb.Separator>}
                  </Fragment>
                )
              })}
            </Breadcrumb.List>
          </Breadcrumb.Root>
        </HStack>
      </Container>
    </Box>
  )
}
