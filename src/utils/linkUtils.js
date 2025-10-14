// Utility function to convert URLs in text to clickable links
export const linkifyText = (text) => {
  if (!text) return text;
  
  // URL regex pattern that matches http/https URLs and www URLs
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  // Split text by URLs and process each part
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    // Check if this part is a URL
    if (urlRegex.test(part)) {
      // Ensure URL has protocol
      const href = part.startsWith('http') ? part : `https://${part}`;
      
      return (
        <a 
          key={index}
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            color: '#4169E1', 
            textDecoration: 'underline',
            wordBreak: 'break-all'
          }}
        >
          {part}
        </a>
      );
    }
    
    // Return regular text
    return part;
  });
};

// Alternative function that returns HTML string (for dangerouslySetInnerHTML)
export const linkifyTextAsHTML = (text) => {
  if (!text) return text;
  
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  return text.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #4169E1; text-decoration: underline; word-break: break-all;">${url}</a>`;
  });
};
