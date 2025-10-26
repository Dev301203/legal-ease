import { useLocation, useNavigate } from "@tanstack/react-router"
import { Box, Container, HStack, Image } from "@chakra-ui/react"
import { Breadcrumb } from "@chakra-ui/react"

interface BreadcrumbItem {
  label: string
  path?: string
  search?: Record<string, unknown>
}

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()

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

      // Mock case titles - in production this would come from backend or context
      const caseTitles: Record<string, string> = {
        "1": "Smith v. Johnson",
        "2": "Estate Planning",
        "3": "Corporate Merger",
      }

      const caseTitle = caseId ? caseTitles[caseId] : "Case"

      items.push({
        label: caseTitle,
        path: "/case",
        search: caseId ? { id: caseId } : undefined,
      })
    }

    // Add Scenario if we're on scenario page
    if (pathname === "/scenario") {
      const search = location.search as { caseId?: number; simulationId?: number }
      const simulationId = search.simulationId

      // Mock simulation titles - in production this would come from backend
      const simulationTitles: Record<number, string> = {
        1: "Mediation Session",
        2: "Settlement Negotiation",
        3: "Trial Outcome",
        4: "Trust Distribution",
        5: "Family Inheritance",
        6: "Valuation Negotiation",
        7: "Regulatory Approval",
      }

      const scenarioTitle = simulationId ? simulationTitles[simulationId] || "Scenario" : "Scenario"

      items.push({ label: scenarioTitle })
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
                  <Breadcrumb.Item key={index}>
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
                    {!isLast && <Breadcrumb.Separator>/</Breadcrumb.Separator>}
                  </Breadcrumb.Item>
                )
              })}
            </Breadcrumb.List>
          </Breadcrumb.Root>
        </HStack>
      </Container>
    </Box>
  )
}
