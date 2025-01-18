'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen relative">
      <div className="sticky top-0">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        
      />
      </div>
    
      <main className="flex-1 flex flex-col w-full">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        {children}
      </main>
    </div>
  );
} 

// 'use client';
// import { useState } from 'react';
// import Sidebar from './Sidebar';
// import Header from './Header';

// export default function AppLayout({ children }: { children: React.ReactNode }) {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

//   return (
//     <div className="flex h-screen relative">
//       <div>
//         <Sidebar 
//           isOpen={isSidebarOpen} 
//           onClose={() => setIsSidebarOpen(false)} 
//         />
//       </div>
    
//       <main className="flex-1 flex flex-col w-full">
//         <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
       
//         <div className="flex-1 overflow-auto sticky bottom-0">
//           {children}
//         </div>
        
     
//       </main>
//     </div>
//   );
// }