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
      const search = location.search as { id?: string }
      let caseId: string | undefined

      if (pathname === "/scenario") {
        // For scenario, we need to extract the case from the simulation
        // Mock data mapping - in production this would come from backend
        const nodeId = search.id
        if (nodeId) {
          const simulationId = nodeId.match(/^(st\d+)/)?.[1]
          const simulationToCaseMap: Record<string, string> = {
            st1: "1",
            st2: "1",
            st3: "1",
            st4: "2",
            st5: "2",
            st6: "3",
            st7: "3",
          }
          caseId = simulationId ? simulationToCaseMap[simulationId] : undefined
        }
      } else {
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
      const search = location.search as { id?: string }
      const nodeId = search.id

      // Mock simulation titles - in production this would come from backend
      const simulationTitles: Record<string, string> = {
        st1: "Mediation Session",
        st2: "Settlement Negotiation",
        st3: "Trial Outcome",
        st4: "Trust Distribution",
        st5: "Family Inheritance",
        st6: "Valuation Negotiation",
        st7: "Regulatory Approval",
      }

      const simulationId = nodeId?.match(/^(st\d+)/)?.[1]
      const scenarioTitle = simulationId ? simulationTitles[simulationId] : "Scenario"

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
