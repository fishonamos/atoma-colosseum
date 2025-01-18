export default 
function extractJsonString(content: string) {
  const jsonMatch =
    content.match(/```(?:json)?\n([\s\S]*?)\n```/) ||
    content.match(/({[\s\S]*})/);
  return jsonMatch ? jsonMatch[1].trim() : content.trim();
}