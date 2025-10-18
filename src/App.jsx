import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import IDE from './IDE'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={< IDE />} />
      </Routes>
    </Router>
  )
}

export default App
