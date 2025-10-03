<script lang="ts">
  import { page } from '$app/stores';
  $: detectionId = $page.params.id;
</script>

<div class="p-8">
  <h1 class="text-2xl font-bold mb-4">Detection Details</h1>
  <p>Detection ID: {detectionId}</p>
  <p>This is a placeholder page for detection details.</p>
</div>
