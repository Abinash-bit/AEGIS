import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MissionProvider } from './lib/mission'
import About from './pages/About'
import Console from './pages/Console'
import HazardPage from './pages/HazardPage'
import Home from './pages/Home'
import Labs from './pages/Labs'
import Library from './pages/Library'
import MemoryPage from './pages/MemoryPage'
import Mission from './pages/Mission'
import Report from './pages/Report'
import SpaceWeather from './pages/SpaceWeather'

export default function App() {
  return (
    <MissionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mission" element={<Mission />} />
          <Route path="/console" element={<Console />} />
          <Route path="/hazards/:id" element={<HazardPage />} />
          <Route path="/labs" element={<Labs />} />
          <Route path="/space-weather" element={<SpaceWeather />} />
          <Route path="/library" element={<Library />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/report" element={<Report />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </MissionProvider>
  )
}
