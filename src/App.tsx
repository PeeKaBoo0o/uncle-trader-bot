import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Services from "./pages/Services.tsx";
import Contact from "./pages/Contact.tsx";
import News from "./pages/News.tsx";
import Analysis from "./pages/Analysis.tsx";
import Indicators from "./pages/Indicators.tsx";
import EconomicCalendar from "./pages/EconomicCalendar.tsx";
import Dictionary from "./pages/Dictionary.tsx";
import DictionaryDetail from "./pages/DictionaryDetail.tsx";
import NewsDetail from "./pages/NewsDetail.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/homepage" element={<Index />} />
          <Route path="/services" element={<Services />} />
          <Route path="/tin-tuc" element={<News />} />
          <Route path="/tin-tuc/:id" element={<NewsDetail />} />
          <Route path="/phan-tich" element={<Analysis />} />
          <Route path="/indicators" element={<Indicators />} />
          <Route path="/chi-bao" element={<Indicators />} />
          <Route path="/lich-kinh-te" element={<EconomicCalendar />} />
          <Route path="/tu-dien" element={<Dictionary />} />
          <Route path="/tu-dien/:slug" element={<DictionaryDetail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
