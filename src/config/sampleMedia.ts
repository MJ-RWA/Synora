export interface SampleMedia {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  poster: string;
  videoUrl: string;
  subtitle?: string;
}

export const SAMPLE_MEDIA: SampleMedia[] = [
  {
    id: 'sample-big-buck-bunny',
    title: 'Big Buck Bunny',
    description: 'A large and lovable rabbit deals with bullying forest creatures in this classic open-source animated short film.',
    category: 'Animation',
    duration: '10 min',
    poster: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  {
    id: 'sample-sintel',
    title: 'Sintel',
    description: 'A lonely young woman searches for a baby dragon she befriended, enduring a perilous journey across the mountains.',
    category: 'Fantasy / Adventure',
    duration: '15 min',
    poster: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
  },
  {
    id: 'sample-tears-of-steel',
    title: 'Tears of Steel',
    description: 'Set in a dystopian future in Amsterdam, a group of warriors and scientists try to save the world from destructive robots.',
    category: 'Sci-Fi / VFX',
    duration: '12 min',
    poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
  },
  {
    id: 'sample-elephants-dream',
    title: 'Elephants Dream',
    description: 'Two men explore the bizarre mechanics inside a surreal, infinite living machine.',
    category: 'Sci-Fi / Surreal',
    duration: '11 min',
    poster: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
  },
  {
    id: 'sample-oceans',
    title: 'Oceans',
    description: 'Deep dive into ocean life and breathtaking underwater scenery captured in crystal clear definition.',
    category: 'Documentary / Nature',
    duration: '12 min',
    poster: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4'
  },
  {
    id: 'sample-for-bigger-blazes',
    title: 'For Bigger Blazes',
    description: 'Spectacular cinematic nature, chromecast sample showcase with rich sound and colors.',
    category: 'Showcase',
    duration: '5 min',
    poster: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  }
];
