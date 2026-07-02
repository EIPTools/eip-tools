import { ReactNode } from "react";
import { Box } from "@chakra-ui/react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <Box display="flex" flexDir="column" minHeight="100vh" bg="bg.base">
      <Box flexGrow={1} overflow="hidden">
        <Navbar />
        <Box flexGrow={1} minW={0} overflowX="auto">
          {children}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
