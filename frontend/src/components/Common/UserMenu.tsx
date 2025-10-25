import { Button, Flex, Text } from "@chakra-ui/react"
import { FaUserAstronaut } from "react-icons/fa"

import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "../ui/menu"

const UserMenu = () => {
  return (
    <>
      {/* Desktop */}
      <Flex>
        <MenuRoot>
          <MenuTrigger asChild p={2}>
            <Button data-testid="user-menu" variant="solid" maxW="sm" truncate>
              <FaUserAstronaut fontSize="18" />
              <Text>User</Text>
            </Button>
          </MenuTrigger>

          <MenuContent>
            <MenuItem
              value="logout"
              gap={2}
              py={2}
              style={{ cursor: "pointer" }}
            >
              Log Out
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      </Flex>
    </>
  )
}

export default UserMenu
