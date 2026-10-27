import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Argus Capture — Multi-camera workspace',description:'Collect, inspect, and synchronize robotics video episodes.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
